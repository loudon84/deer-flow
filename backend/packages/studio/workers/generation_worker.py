import asyncio
import logging
from studio.domain.runtime.adapters import DeerFlowAdapter
from studio.domain.runtime.services.runtime_result_service import RuntimeResultService
from studio.domain.runtime.services.runtime_session_service import RuntimeSessionService
from studio.models.persistence import OWNER_TYPE_JOB
from studio.repositories import JobRepository, RuntimeSessionRepository
from studio.services import ArticleGenerationService
from studio.settings import StudioSettings

logger = logging.getLogger(__name__)


class GenerationWorker:
    """生成 Worker"""

    def __init__(self):
        self.settings = StudioSettings()
        self.job_repo = JobRepository()
        self.generation_service = ArticleGenerationService()
        self.running = False

    async def start(self):
        """启动 Worker"""
        logger.info("Generation Worker started")
        self.running = True

        # 启动时恢复断线前未完成的 job
        try:
            await self._resume_jobs()
        except Exception as e:
            logger.error("Error in _resume_jobs on startup: %s", e, exc_info=True)

        while self.running:
            try:
                await self._process_jobs()
            except Exception as e:
                logger.error(f"Error in Generation Worker: {e}", exc_info=True)

            # 等待下一次轮询
            await asyncio.sleep(self.settings.worker_poll_seconds)

    def stop(self):
        """停止 Worker"""
        logger.info("Generation Worker stopping")
        self.running = False

    async def _process_jobs(self):
        """处理待执行的任务"""
        # 获取待处理任务
        jobs = await self.job_repo.find_queued_jobs(limit=10)

        if not jobs:
            return

        logger.info(f"Found {len(jobs)} queued jobs")

        # 并发处理任务
        tasks = [self._process_job(job) for job in jobs]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _process_job(self, job: dict):
        """处理单个任务"""
        job_id = str(job["_id"])
        logger.info(f"Processing job {job_id}")

        try:
            document_id = await self.generation_service.execute_job(job_id)
            if document_id:
                logger.info(f"Job {job_id} completed, document_id: {document_id}")
            else:
                logger.info(
                    f"Job {job_id} delegated to runtime facade (async completion)"
                )
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}", exc_info=True)

    async def _resume_jobs(self) -> None:
        """恢复 studio 断线重启后未完成的 job。

        遍历所有 status == streaming 的 runtime session，
        检查 deerflow thread 是否已完成，如果已完成则获取结果并持久化文档。
        """
        session_repo = RuntimeSessionRepository()
        sessions = await session_repo.find_by_status("streaming", limit=50)

        if not sessions:
            logger.info("No streaming sessions to resume")
            return

        logger.info("Found %d streaming sessions to resume", len(sessions))

        adapter = DeerFlowAdapter()
        result_service = RuntimeResultService(
            session_repo=session_repo,
            adapter=adapter,
            job_repo=self.job_repo,
        )
        session_service = RuntimeSessionService(
            session_repo=session_repo,
            adapter=adapter,
        )

        tasks = [
            self._resume_session(session, session_repo, session_service, result_service)
            for session in sessions
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        recovered = sum(1 for r in results if r == "recovered")
        skipped = sum(1 for r in results if r == "skipped")
        failed = sum(1 for r in results if isinstance(r, Exception))

        logger.info(
            "Resume complete: recovered=%d, skipped=%d, failed=%d",
            recovered, skipped, failed,
        )

    async def _resume_session(
        self,
        session: dict,
        session_repo: RuntimeSessionRepository,
        session_service: RuntimeSessionService,
        result_service: RuntimeResultService,
    ) -> str:
        """恢复单个 streaming session。

        检查 deerflow thread 状态：
        - 已完成：获取 artifacts 内容，持久化文档
        - 仍在运行：跳过（Session_recovery_worker 会定期处理）
        - 中断：更新为 waiting_human
        - 出错/不存在：标记失败

        Returns:
            "recovered" - 成功恢复
            "skipped" - 跳过
        """
        session_id = str(session["_id"])
        thread_id = session.get("threadId")
        owner_type = session.get("ownerType")
        owner_id = session.get("ownerId")

        if not thread_id:
            logger.warning("Session %s has no threadId, marking as failed", session_id)
            await session_repo.update_status(session_id, "failed", extra={
                "runtimeStatus.failed": True,
                "lastError": "No threadId on resume",
            })
            if owner_type == OWNER_TYPE_JOB and owner_id:
                await self.job_repo.set_failed(owner_id, "No threadId on resume")
            return "skipped"

        try:
            adapter = result_service.adapter
            state = await adapter.get_thread_state(thread_id=thread_id)
        except Exception as e:
            # thread 不存在或无法访问
            if "404" in str(e) or "Not Found" in str(e):
                logger.warning("Session %s thread %s not found, marking as failed", session_id, thread_id)
                await session_repo.update_status(session_id, "failed", extra={
                    "runtimeStatus.failed": True,
                    "lastError": "Thread not found in DeerFlow on resume",
                })
                if owner_type == OWNER_TYPE_JOB and owner_id:
                    await self.job_repo.set_failed(owner_id, "Thread not found in DeerFlow on resume")
                return "recovered"
            raise

        # 判断 thread 状态
        thread_status = self._determine_thread_status(state)

        if thread_status == "completed":
            # Thread 已完成，执行完成流程
            await self._resume_completed_session(
                session, session_repo, session_service, result_service,
            )
            return "recovered"

        elif thread_status == "interrupted":
            # Thread 等待人工介入
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

            await session_repo.update_status(
                session_id, "waiting_human",
                current_interrupt=interrupt_snapshot,
                extra={
                    "runtimeStatus.waitingHuman": True,
                    "runtimeStatus.streaming": False,
                },
            )
            if owner_type == OWNER_TYPE_JOB and owner_id:
                await self.job_repo.set_waiting_human(owner_id)
                logger.info("Resumed job %s to waiting_human", owner_id)
            return "recovered"

        elif thread_status == "error":
            checkpoint = state.get("checkpoint") or {}
            error_msg = checkpoint.get("error") or "Unknown error from thread state"
            await session_repo.update_status(session_id, "failed", extra={
                "runtimeStatus.failed": True,
                "lastError": error_msg,
            })
            if owner_type == OWNER_TYPE_JOB and owner_id:
                await self.job_repo.set_failed(owner_id, error_msg)
                logger.info("Resumed job %s to failed: %s", owner_id, error_msg)
            return "recovered"

        else:
            # 仍在运行或未知状态，跳过（session_recovery_worker 会定期处理）
            logger.debug(
                "Session %s thread %s still %s, skipping resume",
                session_id, thread_id, thread_status,
            )
            return "skipped"

    async def _resume_completed_session(
        self,
        session: dict,
        session_repo: RuntimeSessionRepository,
        session_service: RuntimeSessionService,
        result_service: RuntimeResultService,
    ) -> None:
        """恢复已完成的 session：标记完成 + 获取 artifacts + 持久化文档。"""
        session_id = str(session["_id"])
        owner_type = session.get("ownerType")
        owner_id = session.get("ownerId")

        # 标记 session 完成
        await session_repo.update_status(
            session_id, "completed",
            extra={
                "runtimeStatus.completed": True,
                "runtimeStatus.streaming": False,
                "runtimeStatus.waitingHuman": False,
            },
        )

        # 物化消息结果（用于 chat 页面显示）
        try:
            await result_service.materialize_latest_result(session_id)
        except Exception as e:
            logger.warning("materialize_latest_result failed for session %s: %s", session_id, e)

        # 获取真实的 output artifacts 内容
        artifacts_result = await result_service.get_output_artifacts_content(session_id)

        if owner_type == OWNER_TYPE_JOB and owner_id:
            if artifacts_result:
                # 有真实文件才持久化到文档
                try:
                    doc_id = await result_service.persist_job_success_document(
                        session_id,
                        job_id=owner_id,
                        result=artifacts_result,
                    )
                    logger.info(
                        "Resumed job %s to succeeded with document %s",
                        owner_id, doc_id,
                    )
                except Exception as e:
                    logger.error(
                        "Failed to persist document for job %s: %s",
                        owner_id, e, exc_info=True,
                    )
                    await self.job_repo.set_succeeded(owner_id, None)
            else:
                # 没有生成文件，标记 Job 成功但不关联文档
                logger.info(
                    "No output artifacts found for job %s on resume, marking succeeded without document",
                    owner_id,
                )
                await self.job_repo.set_succeeded(owner_id, None)

        logger.info("Resumed session %s to completed", session_id)

    @staticmethod
    def _determine_thread_status(state: dict) -> str:
        """根据 thread state 判断状态。"""
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
            return "completed"

        # 检查 checkpoint 中的错误
        checkpoint = state.get("checkpoint") or {}
        if checkpoint.get("error"):
            return "error"

        return "running"
