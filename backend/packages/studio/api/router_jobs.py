from fastapi import APIRouter, Depends, HTTPException

from studio.api.deps import get_generation_service
from studio.models.dto import (
    IdResponse,
    JobCreateRequest,
    JobDetailResponse,
    JobResponse,
    OkResponse,
    WorkLogResponse,
)
from studio.repositories import TemplateRepository
from studio.services import ArticleGenerationService

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


def _job_to_response(job: dict) -> JobResponse:
    """转换任务为响应"""
    return JobResponse(
        id=str(job["_id"]),
        status=job["status"],
        document_id=str(job["documentId"]) if job.get("documentId") else None,
        last_error=job.get("lastError"),
    )


async def _job_to_detail_response(job: dict, template_repo: TemplateRepository) -> JobDetailResponse:
    """转换任务为详情响应"""
    # Get template name
    template_name = None
    if job.get("templateId"):
        template = await template_repo.find_by_id(str(job["templateId"]))
        if template:
            template_name = template.get("name")

    # Convert work logs
    work_logs = None
    if job.get("workLogs"):
        work_logs = [
            WorkLogResponse(
                step=log["step"],
                timestamp=log["timestamp"].isoformat() if hasattr(log["timestamp"], "isoformat") else log["timestamp"],
                details=log.get("details", {})
            )
            for log in job["workLogs"]
        ]

    return JobDetailResponse(
        id=str(job["_id"]),
        template_id=str(job["templateId"]),
        template_name=template_name,
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
        total_prompt_tokens=job.get("totalPromptTokens"),
        total_completion_tokens=job.get("totalCompletionTokens"),
        total_tokens=job.get("totalTokens"),
        work_logs=work_logs,
        runtime_session_id=str(job["runtimeSessionId"]) if job.get("runtimeSessionId") else None,
        runtime_provider=job.get("runtimeProvider"),
        runtime_status=job.get("runtimeStatus"),
    )


@router.post("", response_model=IdResponse)
async def create_job(
    request: JobCreateRequest,
    user_id: str = "default_user",  # TODO: 从认证信息获取
    service: ArticleGenerationService = Depends(get_generation_service),
):
    """创建生成任务"""
    try:
        # Support both input_data and input_params (input_data takes priority)
        input_params = request.input_data or request.input_params or {}
        
        # Build prompt override from system and user prompts
        prompt_override = request.prompt_override
        if request.system_prompt_override or request.user_prompt_override:
            prompt_override = {
                "system": request.system_prompt_override,
                "user": request.user_prompt_override,
            }
        
        # Generate title if not provided
        title = request.title or f"Article from template {request.template_id}"
        
        job_id = await service.create_job(
            template_id=request.template_id,
            user_id=user_id,
            title=title,
            input_params=input_params,
            generation_mode=request.generation_mode,
            model_name=request.model_name,
            prompt_override=prompt_override,
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
    template_repo = TemplateRepository()
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return await _job_to_detail_response(job, template_repo)


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
    template_repo = TemplateRepository()
    jobs, _ = await service.list_jobs(
        user_id=user_id,
        template_id=template_id,
        status=status,
        skip=skip,
        limit=limit,
    )
    return [await _job_to_detail_response(j, template_repo) for j in jobs]


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
