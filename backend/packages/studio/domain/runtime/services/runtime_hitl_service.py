from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from bson import ObjectId

from studio.domain.runtime.adapters import DeerFlowAdapter
from studio.domain.runtime.dto import ResumeRuntimeSessionRequest, ResumeRuntimeSessionResponse
from studio.domain.runtime.mappers import DeerFlowEventMapper
from studio.domain.runtime.services.runtime_event_service import RuntimeEventService
from studio.domain.runtime.services.runtime_result_service import RuntimeResultService
from studio.domain.runtime.services.runtime_session_service import RuntimeSessionService
from studio.models.persistence import (
    OWNER_TYPE_JOB,
    RUNTIME_EVENT_INTERRUPT,
    RUNTIME_EVENT_RUN_END,
)
from studio.repositories import JobRepository, RuntimeHitlRepository, RuntimeSessionRepository

logger = logging.getLogger(__name__)


class RuntimeHitlService:
    """HITL 审计与 resume 流消费"""

    def __init__(
        self,
        session_repo: RuntimeSessionRepository | None = None,
        event_service: RuntimeEventService | None = None,
        hitl_repo: RuntimeHitlRepository | None = None,
        adapter: DeerFlowAdapter | None = None,
        mapper: DeerFlowEventMapper | None = None,
        job_repo: JobRepository | None = None,
        session_service: RuntimeSessionService | None = None,
        result_service: RuntimeResultService | None = None,
    ) -> None:
        self.session_repo = session_repo or RuntimeSessionRepository()
        self.event_service = event_service or RuntimeEventService()
        self.hitl_repo = hitl_repo or RuntimeHitlRepository()
        self.adapter = adapter
        self.mapper = mapper or DeerFlowEventMapper()
        self.job_repo = job_repo or JobRepository()
        self.session_service = session_service
        self.result_service = result_service

    def set_adapter(self, adapter: DeerFlowAdapter) -> None:
        self.adapter = adapter

    async def resume_session(
        self,
        session_id: str,
        request: ResumeRuntimeSessionRequest,
        operator_id: str,
    ) -> ResumeRuntimeSessionResponse:
        if self.adapter is None:
            raise RuntimeError("adapter not set")
        session = await self.session_repo.find_by_id(session_id)
        if not session:
            raise ValueError("session not found")
        if session["status"] != "waiting_human":
            raise ValueError("session is not waiting_human")

        summary = session.get("summary") or {}
        await self.hitl_repo.insert_one(
            {
                "sessionId": ObjectId(session_id),
                "ownerType": session["ownerType"],
                "ownerId": session["ownerId"],
                "threadId": session["threadId"],
                "interruptSeq": int(summary.get("lastEventSeq", 0)),
                "actionType": request.action_type,
                "resumeValue": request.resume_value,
                "operatorId": operator_id,
                "comment": request.comment,
                "createdAt": datetime.utcnow(),
            }
        )

        await self.session_repo.update_status(
            session_id,
            "streaming",
            current_interrupt=None,
            extra={"runtimeStatus.waitingHuman": False, "runtimeStatus.streaming": True},
        )

        if session["ownerType"] == OWNER_TYPE_JOB:
            await self.job_repo.update_status(session["ownerId"], "running")

        asyncio.create_task(
            self._consume_resume(session, request.resume_value),
        )

        return ResumeRuntimeSessionResponse(sessionId=session_id, accepted=True, status="streaming")

    async def _consume_resume(self, session: dict[str, Any], resume_value: dict[str, Any]) -> None:
        assert self.adapter is not None
        sid = str(session["_id"])
        try:
            async for frame in self.adapter.resume_run_stream(
                thread_id=session["threadId"],
                resume_value=resume_value,
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
                        if self.session_service:
                            await self.session_service.mark_waiting_human(
                                sid,
                                interrupt_snapshot={
                                    "kind": "approval",
                                    "prompt": (portal_event.get("display") or {}).get("content", "")[:4000],
                                    "raw": portal_event.get("raw_event", {}),
                                },
                            )
                        if session.get("ownerType") == OWNER_TYPE_JOB:
                            await self.job_repo.set_waiting_human(session["ownerId"])
                        return

                    if portal_event["event_type"] == RUNTIME_EVENT_RUN_END:
                        if self.session_service:
                            await self.session_service.mark_completed(sid)
                        if self.result_service:
                            mat = await self.result_service.materialize_latest_result(sid)
                            if mat and session.get("ownerType") == OWNER_TYPE_JOB:
                                await self.result_service.persist_job_success_document(
                                    sid,
                                    job_id=session["ownerId"],
                                    result=mat,
                                )
                        return
        except Exception:
            logger.exception("resume consume failed for session %s", session.get("_id"))
