from __future__ import annotations

from datetime import datetime
from typing import Any

from studio.domain.runtime.adapters import RuntimeAdapter
from studio.domain.runtime.dto import (
    CreateRuntimeSessionRequest,
    CreateRuntimeSessionResponse,
    RuntimeInterruptApi,
    RuntimeSessionDetailResponse,
    RuntimeSummaryApi,
)
from studio.models.persistence import (
    OWNER_TYPE_JOB,
    RUNTIME_PROVIDER_DEERFLOW,
    RUNTIME_SESSION_STATUS_IDLE,
)
from studio.repositories import DocumentRepository, JobRepository, RuntimeSessionRepository


class RuntimeSessionService:
    """Runtime session 生命周期与 owner 绑定"""

    def __init__(
        self,
        session_repo: RuntimeSessionRepository | None = None,
        adapter: RuntimeAdapter | None = None,
        job_repo: JobRepository | None = None,
        document_repo: DocumentRepository | None = None,
    ) -> None:
        self.session_repo = session_repo or RuntimeSessionRepository()
        self.adapter = adapter  # 由 facade 注入
        self.job_repo = job_repo or JobRepository()
        self.document_repo = document_repo or DocumentRepository()

    def set_adapter(self, adapter: RuntimeAdapter) -> None:
        self.adapter = adapter

    async def create_or_get_session(
        self,
        request: CreateRuntimeSessionRequest,
        user_id: str,
    ) -> CreateRuntimeSessionResponse:
        if self.adapter is None:
            raise RuntimeError("RuntimeAdapter not configured")
        existing = await self.session_repo.find_latest_by_owner(
            request.owner_type,
            request.owner_id,
        )
        if existing:
            return CreateRuntimeSessionResponse(
                session_id=str(existing["_id"]),
                thread_id=existing["threadId"],
                status=existing["status"],
            )

        thread_id = await self.adapter.create_thread()
        now = datetime.utcnow()
        rc = request.request_context.model_dump(by_alias=True)
        doc: dict[str, Any] = {
            "ownerType": request.owner_type,
            "ownerId": request.owner_id,
            "userId": user_id,
            "runtimeProvider": request.runtime_provider,
            "assistantId": request.assistant_id,
            "threadId": thread_id,
            "latestRunId": None,
            "status": RUNTIME_SESSION_STATUS_IDLE,
            "runtimeStatus": {
                "phase": "not_started",
                "streaming": False,
                "waitingHuman": False,
                "completed": False,
                "failed": False,
            },
            "requestContext": rc,
            "currentInterrupt": None,
            "summary": {
                "latestAssistantText": None,
                "latestResultType": None,
                "latestResultId": None,
                "lastEventSeq": 0,
            },
            "createdAt": now,
            "updatedAt": now,
        }
        sid = await self.session_repo.insert_one(doc)
        await self._bind_session_to_owner(
            session_id=sid,
            owner_type=request.owner_type,
            owner_id=request.owner_id,
            status=RUNTIME_SESSION_STATUS_IDLE,
        )
        return CreateRuntimeSessionResponse(
            session_id=sid,
            thread_id=thread_id,
            status=RUNTIME_SESSION_STATUS_IDLE,
        )

    async def _bind_session_to_owner(
        self,
        *,
        session_id: str,
        owner_type: str,
        owner_id: str,
        status: str,
    ) -> None:
        if owner_type == OWNER_TYPE_JOB:
            await self.job_repo.patch_runtime_binding(
                owner_id,
                runtime_session_id=session_id,
                runtime_provider=RUNTIME_PROVIDER_DEERFLOW,
                runtime_status=status,
            )
        else:
            await self.document_repo.append_runtime_session(owner_id, session_id)

    async def get_by_id(self, session_id: str) -> dict[str, Any] | None:
        return await self.session_repo.find_by_id(session_id)

    async def get_session_detail(self, session_id: str) -> RuntimeSessionDetailResponse | None:
        doc = await self.session_repo.find_by_id(session_id)
        if not doc:
            return None
        intr = doc.get("currentInterrupt")
        interrupt_api = None
        if intr:
            interrupt_api = RuntimeInterruptApi(
                kind=intr.get("kind", "unknown"),
                prompt=intr.get("prompt", ""),
                raw=intr.get("raw", {}),
            )
        summary = doc.get("summary") or {}
        return RuntimeSessionDetailResponse(
            session_id=str(doc["_id"]),
            owner_type=doc["ownerType"],
            owner_id=doc["ownerId"],
            thread_id=doc["threadId"],
            status=doc["status"],
            current_interrupt=interrupt_api,
            summary=RuntimeSummaryApi(
                latest_assistant_text=summary.get("latestAssistantText"),
                latest_result_type=summary.get("latestResultType"),
                latest_result_id=summary.get("latestResultId"),
                last_event_seq=int(summary.get("lastEventSeq", 0)),
            ),
        )

    async def mark_streaming(self, session_id: str) -> None:
        await self.session_repo.update_status(
            session_id,
            "streaming",
            extra={
                "runtimeStatus.streaming": True,
                "runtimeStatus.phase": "running",
            },
        )

    async def mark_waiting_human(
        self,
        session_id: str,
        *,
        interrupt_snapshot: dict[str, Any],
    ) -> None:
        await self.session_repo.update_status(
            session_id,
            "waiting_human",
            current_interrupt=interrupt_snapshot,
            extra={
                "runtimeStatus.waitingHuman": True,
                "runtimeStatus.streaming": False,
            },
        )

    async def mark_completed(self, session_id: str) -> None:
        await self.session_repo.update_status(
            session_id,
            "completed",
            current_interrupt=None,
            extra={
                "runtimeStatus.completed": True,
                "runtimeStatus.streaming": False,
                "runtimeStatus.waitingHuman": False,
            },
        )

    async def mark_failed(self, session_id: str, detail: str | None = None) -> None:
        await self.session_repo.update_status(
            session_id,
            "failed",
            extra={"runtimeStatus.failed": True, "runtimeStatus.streaming": False, "lastError": detail},
        )
