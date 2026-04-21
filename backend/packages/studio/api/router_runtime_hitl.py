from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from studio.api.deps import get_runtime_hitl_service
from studio.domain.runtime.dto import ResumeRuntimeSessionRequest, ResumeRuntimeSessionResponse
from studio.domain.runtime.services.runtime_hitl_service import RuntimeHitlService

router = APIRouter(prefix="/api/v1/runtime/sessions", tags=["runtime-hitl"])


@router.post("/{session_id}/resume", response_model=ResumeRuntimeSessionResponse)
async def resume_runtime_session(
    session_id: str,
    request: ResumeRuntimeSessionRequest,
    operator_id: str = "default_user",
    service: RuntimeHitlService = Depends(get_runtime_hitl_service),
):
    try:
        return await service.resume_session(session_id, request, operator_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
