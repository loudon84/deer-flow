from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class RuntimeRequestContextApi(BaseModel):
    model_config = {"populate_by_name": True}

    model_name: str = Field(alias="modelName")
    mode: Literal["basic", "pro"] = "pro"
    reasoning_effort: Literal["low", "medium", "high"] = Field(default="medium", alias="reasoningEffort")
    thinking_enabled: bool = Field(default=True, alias="thinkingEnabled")
    plan_mode: bool = Field(default=False, alias="planMode")
    subagent_enabled: bool = Field(default=False, alias="subagentEnabled")


class CreateRuntimeSessionRequest(BaseModel):
    model_config = {"populate_by_name": True}

    owner_type: Literal["job", "document"] = Field(alias="ownerType")
    owner_id: str = Field(alias="ownerId")
    runtime_provider: Literal["deerflow"] = Field(default="deerflow", alias="runtimeProvider")
    assistant_id: str = Field(default="lead_agent", alias="assistantId")
    request_context: RuntimeRequestContextApi = Field(alias="requestContext")


class CreateRuntimeSessionResponse(BaseModel):
    model_config = {"populate_by_name": True}

    session_id: str = Field(alias="sessionId")
    thread_id: str = Field(alias="threadId")
    status: str


class RuntimeInterruptApi(BaseModel):
    model_config = {"populate_by_name": True}

    kind: str
    prompt: str
    raw: dict[str, Any] = Field(default_factory=dict)


class RuntimeSummaryApi(BaseModel):
    model_config = {"populate_by_name": True}

    latest_assistant_text: str | None = Field(default=None, alias="latestAssistantText")
    latest_result_type: str | None = Field(default=None, alias="latestResultType")
    latest_result_id: str | None = Field(default=None, alias="latestResultId")
    last_event_seq: int = Field(default=0, alias="lastEventSeq")


class RuntimeSessionDetailResponse(BaseModel):
    model_config = {"populate_by_name": True}

    session_id: str = Field(alias="sessionId")
    owner_type: str = Field(alias="ownerType")
    owner_id: str = Field(alias="ownerId")
    thread_id: str = Field(alias="threadId")
    status: str
    current_interrupt: RuntimeInterruptApi | None = Field(default=None, alias="currentInterrupt")
    summary: RuntimeSummaryApi


class StartRuntimeRunRequest(BaseModel):
    model_config = {"populate_by_name": True}

    message: str
    request_context: RuntimeRequestContextApi | None = Field(default=None, alias="requestContext")


class StartRuntimeRunResponse(BaseModel):
    model_config = {"populate_by_name": True}

    session_id: str = Field(alias="sessionId")
    accepted: bool
    status: str
