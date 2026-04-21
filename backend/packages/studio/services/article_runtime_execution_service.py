"""通过 RuntimeFacade 执行 Job（Worker 非阻塞启动）。"""

from __future__ import annotations

from typing import Any

from studio.domain.runtime.dto import CreateRuntimeSessionRequest, RuntimeRequestContextApi, StartRuntimeRunRequest
from studio.domain.runtime.services.runtime_facade_service import RuntimeFacadeService


class ArticleRuntimeExecutionService:
    def __init__(self, facade: RuntimeFacadeService | None = None) -> None:
        self.facade = facade or RuntimeFacadeService()

    async def execute_job(self, job: dict[str, Any], *, prompt_build) -> dict[str, Any]:
        """prompt_build: async callable(job) -> {message, request_context}"""
        built = await prompt_build(job)
        user_id = job.get("userId") or "default_user"
        rc = built["request_context"]
        req_ctx = RuntimeRequestContextApi.model_validate(rc)

        create_req = CreateRuntimeSessionRequest(
            owner_type="job",
            owner_id=str(job["_id"]),
            runtime_provider="deerflow",
            assistant_id="lead_agent",
            request_context=req_ctx,
        )
        session = await self.facade.create_or_get_session(create_req, user_id)

        start_req = StartRuntimeRunRequest(
            message=built["message"],
            request_context=req_ctx,
        )
        await self.facade.start_run(session.session_id, start_req)

        return {
            "jobId": str(job["_id"]),
            "sessionId": session.session_id,
            "status": "started",
        }
