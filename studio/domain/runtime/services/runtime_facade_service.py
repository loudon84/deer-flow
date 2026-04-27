from __future__ import annotations

import asyncio
import logging
from typing import Any

from studio.domain.runtime.adapters import DeerFlowAdapter
from studio.domain.runtime.dto import (
    CreateRuntimeSessionRequest,
    CreateRuntimeSessionResponse,
    RuntimeSessionDetailResponse,
    StartRuntimeRunRequest,
    StartRuntimeRunResponse,
)
from studio.domain.runtime.mappers import DeerFlowEventMapper
from studio.domain.runtime.services.runtime_event_service import RuntimeEventService
from studio.domain.runtime.services.runtime_hitl_service import RuntimeHitlService
from studio.domain.runtime.services.runtime_result_service import RuntimeResultService
from studio.domain.runtime.services.runtime_session_service import RuntimeSessionService
from studio.models.persistence import (
    OWNER_TYPE_JOB,
    RUNTIME_EVENT_INTERRUPT,
    RUNTIME_EVENT_RUN_END,
)

logger = logging.getLogger(__name__)


class RuntimeFacadeService:
    """编排 session / run / 事件消费 / 物化"""

    def __init__(
        self,
        session_service: RuntimeSessionService | None = None,
        event_service: RuntimeEventService | None = None,
        hitl_service: RuntimeHitlService | None = None,
        result_service: RuntimeResultService | None = None,
        adapter: DeerFlowAdapter | None = None,
        mapper: DeerFlowEventMapper | None = None,
    ) -> None:
        self.session_service = session_service or RuntimeSessionService()
        self.event_service = event_service or RuntimeEventService()
        self.result_service = result_service or RuntimeResultService()
        self.hitl_service = hitl_service or RuntimeHitlService(
            event_service=self.event_service,
            session_service=self.session_service,
            result_service=self.result_service,
        )
        self.adapter = adapter or DeerFlowAdapter()
        self.mapper = mapper or DeerFlowEventMapper()
        self._wire_adapter()

    def _wire_adapter(self) -> None:
        self.session_service.set_adapter(self.adapter)
        self.result_service.set_adapter(self.adapter)
        self.hitl_service.set_adapter(self.adapter)

    async def create_or_get_session(
        self,
        request: CreateRuntimeSessionRequest,
        user_id: str,
    ) -> CreateRuntimeSessionResponse:
        return await self.session_service.create_or_get_session(request, user_id)

    async def get_session_detail(self, session_id: str) -> RuntimeSessionDetailResponse | None:
        return await self.session_service.get_session_detail(session_id)

    async def get_history(self, session_id: str) -> dict[str, Any]:
        session = await self.session_service.get_by_id(session_id)
        if not session:
            raise ValueError("session not found")
        st = await self.adapter.get_thread_state(thread_id=session["threadId"])
        vals = st.get("values") or {}
        return {
            "sessionId": session_id,
            "threadId": session["threadId"],
            "messages": vals.get("messages", []),
            "latestValues": vals,
            "currentInterrupt": st.get("tasks"),
        }

    async def start_run(self, session_id: str, request: StartRuntimeRunRequest) -> StartRuntimeRunResponse:
        session = await self.session_service.get_by_id(session_id)
        if not session:
            raise ValueError("session not found")

        rc = dict(session.get("requestContext") or {})
        if request.request_context is not None:
            rc.update(request.request_context.model_dump(by_alias=True))

        await self.session_service.mark_streaming(session_id)
        await self.event_service.save_portal_event(
            session,
            {
                "seq": 0,  # seq 由 save_portal_event 原子分配
                "event_type": "run_start",
                "source": "system",
                "display": {
                    "title": "开始执行",
                    "content": "已提交到 DeerFlow",
                    "severity": "info",
                },
                "raw_event": {},
            },
        )

        asyncio.create_task(self._consume_run(session_id, request.message, rc))

        return StartRuntimeRunResponse(sessionId=session_id, accepted=True, status="streaming")

    async def _consume_run(self, session_id: str, message: str, request_context: dict[str, Any]) -> None:
        session = await self.session_service.get_by_id(session_id)
        if not session:
            return
        assert self.adapter is not None

        run_end_received = False  # 追踪是否收到 run_end 事件

        try:
            async for frame in self.adapter.start_run_stream(
                thread_id=session["threadId"],
                message=message,
                request_context=request_context,
                assistant_id=session["assistantId"],
            ):
                parsed = self.mapper.parse_sse_frame(frame.get("sse_event"), frame["raw_line"])
                if not parsed:
                    continue
                parsed_items = parsed if isinstance(parsed, list) else [parsed]
                for item in parsed_items:
                    portal_event = self.mapper.to_portal_event(item, seq=0)
                    await self.event_service.save_portal_event(session, portal_event)

                    if portal_event["event_type"] == RUNTIME_EVENT_INTERRUPT:
                        await self.session_service.mark_waiting_human(
                            session_id,
                            interrupt_snapshot={
                                "kind": "approval",
                                "prompt": (portal_event.get("display") or {}).get("content", "")[:4000],
                                "raw": portal_event.get("raw_event", {}),
                            },
                        )
                        if session.get("ownerType") == OWNER_TYPE_JOB:
                            await self.session_service.job_repo.set_waiting_human(session["ownerId"])
                        return

                    if portal_event["event_type"] == RUNTIME_EVENT_RUN_END:
                        run_end_received = True
                        await self._handle_run_completion(session_id, session)
                        return

            # SSE 流正常结束但未收到 run_end 事件 — 兜底处理
            if not run_end_received:
                logger.warning("SSE stream ended without run_end event for session %s", session_id)
                # 重新获取 session（可能已被更新）
                session = await self.session_service.get_by_id(session_id)
                if session and session.get("status") == "streaming":
                    await self._handle_run_completion(session_id, session)

        except Exception as e:
            logger.exception("consume_run failed: %s", e)
            await self.session_service.mark_failed(session_id, str(e))
            if session.get("ownerType") == OWNER_TYPE_JOB:
                await self.session_service.job_repo.set_failed(session["ownerId"], str(e))

    async def _handle_run_completion(self, session_id: str, session: dict) -> None:
        """处理 run 完成（无论是收到 run_end 还是 SSE 流结束的兜底）"""
        await self.session_service.mark_completed(session_id)
        
        # 物化消息结果（用于 chat 页面显示）
        mat = await self.result_service.materialize_latest_result(session_id)
        
        # 获取真实的 output artifacts 内容（用于最终文档）
        artifacts_result = await self.result_service.get_output_artifacts_content(session_id)
        
        if session.get("ownerType") == OWNER_TYPE_JOB:
            if artifacts_result:
                # 有真实文件才持久化到文档
                await self.result_service.persist_job_success_document(
                    session_id,
                    job_id=session["ownerId"],
                    result=artifacts_result,
                )
            else:
                # 没有生成文件，标记 Job 成功但不关联文档
                logger.info(
                    "No output artifacts found for job %s, marking succeeded without document",
                    session["ownerId"],
                )
                await self.session_service.job_repo.set_succeeded(session["ownerId"], None)
