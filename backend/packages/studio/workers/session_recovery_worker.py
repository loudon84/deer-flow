"""
Session Recovery Worker

定期检查卡住的 Runtime Session，验证 DeerFlow thread 状态并同步修复。
解决 SSE 流异常断开导致 Job/Session 状态不一致的问题。
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

from studio.domain.runtime.adapters import DeerFlowAdapter
from studio.domain.runtime.mappers import RuntimeResultMapper
from studio.models.persistence import OWNER_TYPE_JOB
from studio.repositories import JobRepository, RuntimeSessionRepository
from studio.settings import StudioSettings

logger = logging.getLogger(__name__)


class SessionRecoveryWorker:
    """Session 状态恢复 Worker

    功能：
    1. 定期查询 streaming 状态超时的 session
    2. 调用 DeerFlow API 获取 thread 实际状态
    3. 根据实际状态同步修复 Session 和 Job 状态
    """

    def __init__(
        self,
        *,
        poll_seconds: float | None = None,
        stuck_timeout_seconds: int = 300,
        batch_size: int = 10,
    ) -> None:
        self.settings = StudioSettings()
        self.poll_seconds = poll_seconds or self.settings.worker_poll_seconds * 2  # 默认 6 秒
        self.stuck_timeout_seconds = stuck_timeout_seconds
        self.batch_size = batch_size

        self.session_repo = RuntimeSessionRepository()
        self.job_repo = JobRepository()
        self.adapter = DeerFlowAdapter()
        self.result_mapper = RuntimeResultMapper()

        self.running = False

    async def start(self) -> None:
        """启动 Worker"""
        logger.info(
            "Session Recovery Worker started (poll=%.1fs, stuck_timeout=%ds)",
            self.poll_seconds,
            self.stuck_timeout_seconds,
        )
        self.running = True

        while self.running:
            try:
                await self._recover_stuck_sessions()
            except Exception as e:
                logger.error("Error in Session Recovery Worker: %s", e, exc_info=True)

            await asyncio.sleep(self.poll_seconds)

    def stop(self) -> None:
        """停止 Worker"""
        logger.info("Session Recovery Worker stopping")
        self.running = False

    async def _recover_stuck_sessions(self) -> None:
        """恢复卡住的 session"""
        # 查询卡住的 session
        stuck_sessions = await self.session_repo.find_stuck_sessions(
            status="streaming",
            timeout_seconds=self.stuck_timeout_seconds,
            limit=self.batch_size,
        )

        if not stuck_sessions:
            return

        logger.info("Found %d stuck sessions to recover", len(stuck_sessions))

        # 并发处理
        tasks = [self._recover_session(session) for session in stuck_sessions]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 统计结果
        recovered = sum(1 for r in results if r == "recovered")
        already_done = sum(1 for r in results if r == "already_done")
        failed = sum(1 for r in results if isinstance(r, Exception))

        logger.info(
            "Recovery complete: recovered=%d, already_done=%d, failed=%d",
            recovered,
            already_done,
            failed,
        )

    async def _recover_session(self, session: dict) -> str:
        """恢复单个 session

        Returns:
            "recovered" - 成功恢复
            "already_done" - thread 已完成，无需恢复
            "skipped" - 跳过（如 thread 不存在）
        """
        session_id = str(session["_id"])
        thread_id = session.get("threadId")
        owner_type = session.get("ownerType")
        owner_id = session.get("ownerId")

        if not thread_id:
            logger.warning("Session %s has no threadId, skipping", session_id)
            return "skipped"

        try:
            # 获取 DeerFlow thread 状态
            state = await self.adapter.get_thread_state(thread_id=thread_id)
            thread_status = self._determine_thread_status(state)

            logger.debug(
                "Session %s thread %s status: %s",
                session_id,
                thread_id,
                thread_status,
            )

            if thread_status == "completed":
                # Thread 已完成，执行完成流程
                await self._handle_completed_session(session, state)
                return "recovered"

            elif thread_status == "interrupted":
                # Thread 等待人工介入
                await self._handle_interrupted_session(session, state)
                return "recovered"

            elif thread_status == "error":
                # Thread 出错
                await self._handle_failed_session(session, state)
                return "recovered"

            elif thread_status == "running":
                # Thread 仍在运行，更新 session updatedAt 防止重复检查
                await self.session_repo.update_status(session_id, "streaming")
                logger.debug("Session %s thread still running, updated timestamp", session_id)
                return "still_running"

            else:
                logger.warning(
                    "Session %s thread %s has unknown status: %s",
                    session_id,
                    thread_id,
                    thread_status,
                )
                return "skipped"

        except Exception as e:
            logger.error(
                "Failed to recover session %s (thread %s): %s",
                session_id,
                thread_id,
                e,
                exc_info=True,
            )

            # 如果是 404 错误，说明 thread 不存在，标记为失败
            if "404" in str(e) or "Not Found" in str(e):
                await self._handle_missing_thread(session)
                return "recovered"

            raise

    def _determine_thread_status(self, state: dict[str, Any]) -> str:
        """根据 thread state 判断状态

        LangGraph thread state 结构：
        - values: 当前状态值
        - next: 下一步要执行的节点列表
        - tasks: 当前任务列表（包含 interrupt 信息）
        - checkpoint: checkpoint 信息
        """
        if not state:
            return "unknown"

        # 检查是否有 interrupt
        tasks = state.get("tasks") or []
        for task in tasks:
            if task.get("interrupts"):
                return "interrupted"

        # 检查 next 列表
        next_nodes = state.get("next") or []
        if not next_nodes:
            # next 为空表示执行完成
            return "completed"

        # 检查 checkpoint 中的错误
        checkpoint = state.get("checkpoint") or {}
        if checkpoint.get("error"):
            return "error"

        # 默认认为仍在运行
        return "running"

    async def _handle_completed_session(self, session: dict, state: dict) -> None:
        """处理已完成的 session"""
        session_id = str(session["_id"])

        # 更新 session 状态
        await self.session_repo.update_status(
            session_id,
            "completed",
            extra={
                "runtimeStatus.completed": True,
                "runtimeStatus.streaming": False,
                "runtimeStatus.waitingHuman": False,
            },
        )

        # 物化结果
        result = self.result_mapper.from_thread_state(state)
        if result:
            await self.session_repo.set_materialized_result(session_id, result)

        # 如果是 Job 类型，更新 Job 状态
        if session.get("ownerType") == OWNER_TYPE_JOB:
            job_id = session.get("ownerId")
            if job_id:
                if result:
                    # 创建文档并标记成功
                    from studio.repositories import DocumentRepository

                    doc_repo = DocumentRepository()
                    job = await self.job_repo.find_by_id(job_id)
                    if job:
                        template_id = str(job.get("templateId"))
                        try:
                            doc_id = await doc_repo.create_from_runtime_result(
                                job_id=job_id,
                                template_id=template_id,
                                title=result.get("title") or "未命名文档",
                                content_markdown=result.get("content") or "",
                                summary=None,
                                keywords=[],
                                metadata={
                                    "source": "deerflow_recovery",
                                    "runtimeSessionId": session_id,
                                },
                            )
                            await self.job_repo.set_succeeded(job_id, doc_id)
                            logger.info(
                                "Recovered job %s to succeeded with document %s",
                                job_id,
                                doc_id,
                            )
                        except Exception as e:
                            logger.error("Failed to create document for job %s: %s", job_id, e)
                            await self.job_repo.set_succeeded(job_id, None)
                else:
                    await self.job_repo.set_succeeded(job_id, None)
                    logger.info("Recovered job %s to succeeded (no document)", job_id)

        logger.info("Recovered session %s to completed", session_id)

    async def _handle_interrupted_session(self, session: dict, state: dict) -> None:
        """处理等待人工介入的 session"""
        session_id = str(session["_id"])

        # 提取 interrupt 信息
        tasks = state.get("tasks") or []
        interrupt_snapshot = None
        for task in tasks:
            if task.get("interrupts"):
                interrupt_snapshot = {
                    "kind": "approval",
                    "prompt": str(task["interrupts"])[:4000],
                    "raw": task,
                }
                break

        # 更新 session 状态
        await self.session_repo.update_status(
            session_id,
            "waiting_human",
            current_interrupt=interrupt_snapshot,
            extra={
                "runtimeStatus.waitingHuman": True,
                "runtimeStatus.streaming": False,
            },
        )

        # 如果是 Job 类型，更新 Job 状态
        if session.get("ownerType") == OWNER_TYPE_JOB:
            job_id = session.get("ownerId")
            if job_id:
                await self.job_repo.set_waiting_human(job_id)
                logger.info("Recovered job %s to waiting_human", job_id)

        logger.info("Recovered session %s to waiting_human", session_id)

    async def _handle_failed_session(self, session: dict, state: dict) -> None:
        """处理失败的 session"""
        session_id = str(session["_id"])

        # 提取错误信息
        checkpoint = state.get("checkpoint") or {}
        error_msg = checkpoint.get("error") or "Unknown error"

        # 更新 session 状态
        await self.session_repo.update_status(
            session_id,
            "failed",
            extra={
                "runtimeStatus.failed": True,
                "runtimeStatus.streaming": False,
                "lastError": error_msg,
            },
        )

        # 如果是 Job 类型，更新 Job 状态
        if session.get("ownerType") == OWNER_TYPE_JOB:
            job_id = session.get("ownerId")
            if job_id:
                await self.job_repo.set_failed(job_id, error_msg)
                logger.info("Recovered job %s to failed", job_id)

        logger.info("Recovered session %s to failed: %s", session_id, error_msg)

    async def _handle_missing_thread(self, session: dict) -> None:
        """处理 thread 不存在的 session"""
        session_id = str(session["_id"])

        # 更新 session 状态为失败
        await self.session_repo.update_status(
            session_id,
            "failed",
            extra={
                "runtimeStatus.failed": True,
                "runtimeStatus.streaming": False,
                "lastError": "Thread not found in DeerFlow",
            },
        )

        # 如果是 Job 类型，更新 Job 状态
        if session.get("ownerType") == OWNER_TYPE_JOB:
            job_id = session.get("ownerId")
            if job_id:
                await self.job_repo.set_failed(job_id, "Thread not found in DeerFlow")
                logger.info("Recovered job %s to failed (thread missing)", job_id)

        logger.warning("Session %s thread not found, marked as failed", session_id)
