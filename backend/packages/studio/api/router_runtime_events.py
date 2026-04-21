from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from studio.api.deps import get_runtime_event_service
from studio.domain.runtime.dto import RuntimeEventListResponse
from studio.domain.runtime.services.runtime_event_service import RuntimeEventService

router = APIRouter(prefix="/api/v1/runtime/sessions", tags=["runtime-events"])


@router.get("/{session_id}/events", response_model=RuntimeEventListResponse)
async def list_runtime_events(
    session_id: str,
    cursor: int = 0,
    limit: int = 50,
    service: RuntimeEventService = Depends(get_runtime_event_service),
):
    return await service.list_events(session_id, cursor=cursor, limit=limit)


@router.get("/{session_id}/stream")
async def stream_runtime_events(
    session_id: str,
    service: RuntimeEventService = Depends(get_runtime_event_service),
):
    async def gen():
        async for chunk in service.stream_events(session_id):
            yield chunk

    return StreamingResponse(gen(), media_type="text/event-stream")
