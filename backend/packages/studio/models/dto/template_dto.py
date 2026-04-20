from pydantic import BaseModel, Field
from typing import Any


class TemplateCreateRequest(BaseModel):
    """模板创建请求"""

    code: str
    name: str
    description: str | None = None
    category: str
    status: str = "draft"
    tags: list[str] = Field(default_factory=list)
    input_schema: dict[str, Any]
    system_prompt: str | None = None
    user_prompt_template: str
    default_model_name: str
    default_generation_mode: str
    reasoning_effort: str | None = None


class TemplateUpdateRequest(BaseModel):
    """模板更新请求"""

    name: str | None = None
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class TemplateVersionCreateRequest(BaseModel):
    """模板版本创建请求"""

    input_schema: dict[str, Any]
    system_prompt: str | None = None
    user_prompt_template: str
    default_model_name: str
    default_generation_mode: str
    reasoning_effort: str | None = None
    example_input: dict[str, Any] | None = None
    example_output: str | None = None


class TemplateResponse(BaseModel):
    """模板响应"""

    id: str
    code: str
    name: str
    description: str | None = None
    category: str
    status: str
    current_version: int
    default_model_name: str
    default_generation_mode: str
    reasoning_effort: str | None = None
    tags: list[str]


class TemplateVersionResponse(BaseModel):
    """模板版本响应"""

    id: str
    template_id: str
    version: int
    input_schema: dict[str, Any]
    system_prompt: str | None = None
    user_prompt_template: str
    default_model_name: str
    default_generation_mode: str
    reasoning_effort: str | None = None
    example_input: dict[str, Any] | None = None
    example_output: str | None = None
    created_at: str
