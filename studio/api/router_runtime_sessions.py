from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from studio.api.deps import get_runtime_facade_service
from studio.domain.runtime.dto import (
    CreateRuntimeSessionRequest,
    CreateRuntimeSessionResponse,
    RuntimeSessionDetailResponse,
    StartRuntimeRunRequest,
    StartRuntimeRunResponse,
)
from studio.domain.runtime.services.runtime_facade_service import RuntimeFacadeService

router = APIRouter(prefix="/api/v1/runtime/sessions", tags=["runtime-sessions"])


@router.post("", response_model=CreateRuntimeSessionResponse)
async def create_runtime_session(
    request: CreateRuntimeSessionRequest,
    user_id: str = "default_user",
    service: RuntimeFacadeService = Depends(get_runtime_facade_service),
):
    try:
        return await service.create_or_get_session(request, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{session_id}", response_model=RuntimeSessionDetailResponse)
async def get_runtime_session(
    session_id: str,
    service: RuntimeFacadeService = Depends(get_runtime_facade_service),
):
    detail = await service.get_session_detail(session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="session not found")
    return detail


@router.post("/{session_id}/runs", response_model=StartRuntimeRunResponse)
async def start_runtime_run(
    session_id: str,
    request: StartRuntimeRunRequest,
    service: RuntimeFacadeService = Depends(get_runtime_facade_service),
):
    try:
        return await service.start_run(session_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{session_id}/history")
async def get_runtime_history(
    session_id: str,
    service: RuntimeFacadeService = Depends(get_runtime_facade_service),
):
    try:
        return await service.get_history(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
