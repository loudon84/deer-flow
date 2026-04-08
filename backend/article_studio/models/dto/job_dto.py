from pydantic import BaseModel
from typing import Any


class JobCreateRequest(BaseModel):
    """任务创建请求"""

    template_id: str
    title: str
    input_params: dict[str, Any]
    generation_mode: str | None = None
    model_name: str | None = None
    prompt_override: str | None = None


class JobResponse(BaseModel):
    """任务响应"""

    id: str
    status: str
    document_id: str | None = None
    last_error: str | None = None


class JobDetailResponse(BaseModel):
    """任务详情响应"""

    id: str
    template_id: str
    user_id: str
    title: str
    input_params: dict[str, Any]
    generation_mode: str
    model_name: str
    status: str
    document_id: str | None = None
    last_error: str | None = None
    created_at: str
    updated_at: str
