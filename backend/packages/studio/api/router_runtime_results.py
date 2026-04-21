from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from studio.api.deps import get_runtime_result_service
from studio.domain.runtime.dto import (
    ApplyRuntimeResultRequest,
    ApplyRuntimeResultResponse,
    LatestRuntimeResultResponse,
)
from studio.domain.runtime.services.runtime_result_service import RuntimeResultService

router = APIRouter(prefix="/api/v1", tags=["runtime-results"])


@router.get("/runtime/sessions/{session_id}/results/latest", response_model=LatestRuntimeResultResponse)
async def get_latest_runtime_result(
    session_id: str,
    service: RuntimeResultService = Depends(get_runtime_result_service),
):
    out = await service.get_latest_result(session_id)
    if out:
        return out

    # 兼容：结果可能尚未物化（例如 run_end 刚发生或事件消费异常），这里按需触发一次物化再返回。
    try:
        await service.materialize_latest_result(session_id)
    except Exception:
        # 物化失败时仍保持 404 语义（避免暴露底层细节给前端）
        pass

    out = await service.get_latest_result(session_id)
    if not out:
        raise HTTPException(status_code=404, detail="no materialized result")
    return out


@router.post(
    "/documents/{document_id}/runtime-results/{result_id}/apply",
    response_model=ApplyRuntimeResultResponse,
)
async def apply_runtime_result_to_document(
    document_id: str,
    result_id: str,
    body: ApplyRuntimeResultRequest,
    service: RuntimeResultService = Depends(get_runtime_result_service),
):
    try:
        return await service.apply_result_to_document(document_id, result_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
