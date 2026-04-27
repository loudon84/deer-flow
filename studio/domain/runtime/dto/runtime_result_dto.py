from __future__ import annotations

from pydantic import BaseModel, Field


class LatestRuntimeResultResponse(BaseModel):
    model_config = {"populate_by_name": True}

    result_id: str = Field(alias="resultId")
    result_type: str = Field(alias="resultType")
    title: str | None = None
    content: str | None = None
    created_at: str | None = Field(default=None, alias="createdAt")


class ApplyRuntimeResultRequest(BaseModel):
    model_config = {"populate_by_name": True}

    apply_mode: str = Field(alias="applyMode")


class ApplyRuntimeResultResponse(BaseModel):
    model_config = {"populate_by_name": True}

    document_id: str = Field(alias="documentId")
    applied: bool
    apply_mode: str = Field(alias="applyMode")
    new_version: int = Field(alias="newVersion")
