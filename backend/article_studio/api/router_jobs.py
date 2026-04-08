from fastapi import APIRouter, HTTPException, Depends
from article_studio.api.deps import get_generation_service
from article_studio.models.dto import (
    JobCreateRequest,
    JobResponse,
    JobDetailResponse,
    IdResponse,
    OkResponse,
)
from article_studio.services import ArticleGenerationService

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


def _job_to_response(job: dict) -> JobResponse:
    """转换任务为响应"""
    return JobResponse(
        id=str(job["_id"]),
        status=job["status"],
        document_id=str(job["documentId"]) if job.get("documentId") else None,
        last_error=job.get("lastError"),
    )


def _job_to_detail_response(job: dict) -> JobDetailResponse:
    """转换任务为详情响应"""
    return JobDetailResponse(
        id=str(job["_id"]),
        template_id=str(job["templateId"]),
        user_id=job["userId"],
        title=job["title"],
        input_params=job["inputParams"],
        generation_mode=job["generationMode"],
        model_name=job["modelName"],
        status=job["status"],
        document_id=str(job["documentId"]) if job.get("documentId") else None,
        last_error=job.get("lastError"),
        created_at=job["createdAt"].isoformat(),
        updated_at=job["updatedAt"].isoformat(),
    )


@router.post("", response_model=IdResponse)
async def create_job(
    request: JobCreateRequest,
    user_id: str = "default_user",  # TODO: 从认证信息获取
    service: ArticleGenerationService = Depends(get_generation_service),
):
    """创建生成任务"""
    try:
        job_id = await service.create_job(
            template_id=request.template_id,
            user_id=user_id,
            title=request.title,
            input_params=request.input_params,
            generation_mode=request.generation_mode,
            model_name=request.model_name,
            prompt_override=request.prompt_override,
        )
        return IdResponse(id=job_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job(
    job_id: str,
    service: ArticleGenerationService = Depends(get_generation_service),
):
    """获取任务详情"""
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_detail_response(job)


@router.get("", response_model=list[JobDetailResponse])
async def list_jobs(
    template_id: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 20,
    user_id: str = "default_user",  # TODO: 从认证信息获取
    service: ArticleGenerationService = Depends(get_generation_service),
):
    """列表查询任务"""
    jobs, _ = await service.list_jobs(
        user_id=user_id,
        template_id=template_id,
        status=status,
        skip=skip,
        limit=limit,
    )
    return [_job_to_detail_response(j) for j in jobs]


@router.post("/{job_id}/cancel", response_model=OkResponse)
async def cancel_job(
    job_id: str,
    service: ArticleGenerationService = Depends(get_generation_service),
):
    """取消任务"""
    success = await service.cancel_job(job_id)
    if not success:
        raise HTTPException(
            status_code=400, detail="Cannot cancel job (not in queued status)"
        )
    return OkResponse()


@router.post("/{job_id}/retry", response_model=IdResponse)
async def retry_job(
    job_id: str,
    service: ArticleGenerationService = Depends(get_generation_service),
):
    """重试任务"""
    try:
        new_job_id = await service.retry_job(job_id)
        return IdResponse(id=new_job_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
