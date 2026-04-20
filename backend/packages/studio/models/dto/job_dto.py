from pydantic import BaseModel, Field
from typing import Any
from datetime import datetime


class JobCreateRequest(BaseModel):
    """任务创建请求"""

    template_id: str
    title: str | None = None
    input_data: dict[str, Any] | None = None
    input_params: dict[str, Any] | None = None  # Deprecated, use input_data
    generation_mode: str | None = None
    model_name: str | None = None
    prompt_override: str | None = None
    system_prompt_override: str | None = None
    user_prompt_override: str | None = None


class WorkLogResponse(BaseModel):
    """工作日志响应"""

    step: str
    timestamp: str
    details: dict[str, Any]


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
    template_name: str | None = None
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
    total_prompt_tokens: int | None = None
    total_completion_tokens: int | None = None
    total_tokens: int | None = None
    work_logs: list[WorkLogResponse] | None = None
