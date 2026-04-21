from __future__ import annotations

from pydantic import BaseModel, Field


class RuntimeEventDisplayApi(BaseModel):
    model_config = {"populate_by_name": True}

    title: str
    content: str | None = None
    severity: str = "info"


class RuntimeEventItem(BaseModel):
    model_config = {"populate_by_name": True}

    event_id: str = Field(alias="eventId")
    seq: int
    event_type: str = Field(alias="eventType")
    source: str
    display: RuntimeEventDisplayApi
    created_at: str = Field(alias="createdAt")


class RuntimeEventListResponse(BaseModel):
    model_config = {"populate_by_name": True}

    items: list[RuntimeEventItem]
    next_cursor: int | None = Field(default=None, alias="nextCursor")
