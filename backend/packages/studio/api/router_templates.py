from fastapi import APIRouter, HTTPException, Depends
from studio.api.deps import get_template_service
from studio.models.dto import (
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateVersionCreateRequest,
    TemplateResponse,
    TemplateVersionResponse,
    IdResponse,
    OkResponse,
)
from studio.services import TemplateService

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])


def _template_to_response(template: dict) -> TemplateResponse:
    """转换模板为响应"""
    return TemplateResponse(
        id=str(template["_id"]),
        code=template["code"],
        name=template["name"],
        description=template.get("description"),
        category=template["category"],
        status=template["status"],
        current_version=template["currentVersion"],
        default_model_name=template.get("defaultModelName", ""),
        default_generation_mode=template.get("defaultGenerationMode", ""),
        reasoning_effort=template.get("reasoningEffort"),
        tags=template.get("tags", []),
    )


def _version_to_response(version: dict) -> TemplateVersionResponse:
    """转换版本为响应"""
    return TemplateVersionResponse(
        id=str(version["_id"]),
        template_id=str(version["templateId"]),
        version=version["version"],
        input_schema=version["schema"],
        system_prompt=version.get("systemPrompt"),
        user_prompt_template=version["userPromptTemplate"],
        default_model_name=version["defaultModelName"],
        default_generation_mode=version["defaultGenerationMode"],
        reasoning_effort=version.get("reasoningEffort"),
        example_input=version.get("exampleInput"),
        example_output=version.get("exampleOutput"),
        created_at=version["createdAt"].isoformat(),
    )


@router.post("", response_model=IdResponse)
async def create_template(
    request: TemplateCreateRequest,
    service: TemplateService = Depends(get_template_service),
):
    """创建模板"""
    try:
        template_id = await service.create_template(request.model_dump())
        return IdResponse(id=template_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    service: TemplateService = Depends(get_template_service),
):
    """获取模板详情"""
    template = await service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_to_response(template)


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    status: str | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 20,
    service: TemplateService = Depends(get_template_service),
):
    """列表查询模板"""
    templates, _ = await service.list_templates(
        status=status, category=category, skip=skip, limit=limit
    )
    return [_template_to_response(t) for t in templates]


@router.put("/{template_id}", response_model=OkResponse)
async def update_template(
    template_id: str,
    request: TemplateUpdateRequest,
    service: TemplateService = Depends(get_template_service),
):
    """更新模板"""
    try:
        await service.update_template(template_id, request.model_dump(exclude_none=True))
        return OkResponse()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{template_id}", response_model=OkResponse)
async def delete_template(
    template_id: str,
    service: TemplateService = Depends(get_template_service),
):
    """删除模板"""
    success = await service.delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return OkResponse()


@router.post("/{template_id}/versions", response_model=IdResponse)
async def create_version(
    template_id: str,
    request: TemplateVersionCreateRequest,
    service: TemplateService = Depends(get_template_service),
):
    """创建模板版本"""
    try:
        version = await service.create_version(template_id, request.model_dump())
        return IdResponse(id=str(version))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{template_id}/versions", response_model=list[TemplateVersionResponse])
async def list_versions(
    template_id: str,
    skip: int = 0,
    limit: int = 20,
    service: TemplateService = Depends(get_template_service),
):
    """获取模板版本列表"""
    versions, _ = await service.list_versions(template_id, skip=skip, limit=limit)
    return [_version_to_response(v) for v in versions]


@router.get(
    "/{template_id}/versions/{version}", response_model=TemplateVersionResponse
)
async def get_version(
    template_id: str,
    version: int,
    service: TemplateService = Depends(get_template_service),
):
    """获取特定版本"""
    version_data = await service.get_version(template_id, version)
    if not version_data:
        raise HTTPException(status_code=404, detail="Version not found")
    return _version_to_response(version_data)
