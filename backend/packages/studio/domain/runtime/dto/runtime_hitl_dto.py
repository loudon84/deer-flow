from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ResumeRuntimeSessionRequest(BaseModel):
    model_config = {"populate_by_name": True}

    action_type: Literal["approve", "reject", "revise", "custom_resume"] = Field(alias="actionType")
    resume_value: dict[str, Any] = Field(alias="resumeValue")
    comment: str | None = None


class ResumeRuntimeSessionResponse(BaseModel):
    model_config = {"populate_by_name": True}

    session_id: str = Field(alias="sessionId")
    accepted: bool
    status: str
