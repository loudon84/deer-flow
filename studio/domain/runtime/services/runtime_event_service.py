from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

from bson import ObjectId

from studio.domain.runtime.dto import RuntimeEventDisplayApi, RuntimeEventItem, RuntimeEventListResponse
from studio.domain.runtime.mappers import DeerFlowEventMapper
from studio.repositories import RuntimeEventRepository, RuntimeSessionRepository

logger = logging.getLogger(__name__)


class RuntimeEventService:
    """Runtime 事件持久化、列表与 SSE 流（轮询增量）"""

    def __init__(
        self,
        event_repo: RuntimeEventRepository | None = None,
        session_repo: RuntimeSessionRepository | None = None,
        mapper: DeerFlowEventMapper | None = None,
    ) -> None:
        self.event_repo = event_repo or RuntimeEventRepository()
        self.session_repo = session_repo or RuntimeSessionRepository()
        self.mapper = mapper or DeerFlowEventMapper()

    async def append_event(
        self,
        *,
        session_id: str,
        session: dict[str, Any],
        seq: int,
        event_type: str,
        source: str,
        display_title: str,
        display_content: str | None,
        severity: str,
        raw_event: dict[str, Any],
    ) -> str:
        oid = ObjectId(session_id)
        doc: dict[str, Any] = {
            "sessionId": oid,
            "ownerType": session["ownerType"],
            "ownerId": session["ownerId"],
            "threadId": session["threadId"],
            "seq": seq,
            "eventType": event_type,
            "source": source,
            "display": {
                "title": display_title,
                "content": display_content,
                "severity": severity,
            },
            "rawEvent": raw_event,
            "createdAt": datetime.utcnow(),
        }
        return await self.event_repo.insert_one(doc)

    async def save_portal_event(self, session: dict[str, Any], portal_event: dict[str, Any]) -> str:
        session_id = str(session["_id"])
        display = portal_event.get("display") or {}
        # 原子递增 lastEventSeq 获取唯一 seq，避免竞态
        seq = await self.session_repo.atomic_inc_last_event_seq(session_id)
        if seq is None:
            # fallback：使用 portal_event 中携带的 seq（兼容旧调用方式）
            seq = portal_event["seq"]
            await self.session_repo.patch_summary_fields(
                session_id,
                {"lastEventSeq": seq},
            )
        eid = await self.append_event(
            session_id=session_id,
            session=session,
            seq=seq,
            event_type=portal_event["event_type"],
            source=portal_event.get("source", "system"),
            display_title=display.get("title", ""),
            display_content=display.get("content"),
            severity=display.get("severity", "info"),
            raw_event=portal_event.get("raw_event", {}),
        )
        return eid

    async def list_events(
        self,
        session_id: str,
        *,
        cursor: int = 0,
        limit: int = 50,
    ) -> RuntimeEventListResponse:
        items_raw, next_c = await self.event_repo.list_after_seq(
            session_id, after_seq=cursor, limit=limit
        )
        items: list[RuntimeEventItem] = []
        for row in items_raw:
            disp = row.get("display") or {}
            items.append(
                RuntimeEventItem(
                    eventId=str(row["_id"]),
                    seq=row["seq"],
                    eventType=row["eventType"],
                    source=row.get("source", "system"),
                    display=RuntimeEventDisplayApi(
                        title=disp.get("title", ""),
                        content=disp.get("content"),
                        severity=disp.get("severity", "info"),
                    ),
                    createdAt=row["createdAt"].isoformat() + "Z"
                    if hasattr(row["createdAt"], "isoformat")
                    else str(row["createdAt"]),
                )
            )
        return RuntimeEventListResponse(items=items, nextCursor=next_c)

    # session 终态集合，遇到这些状态时 SSE 流应停止轮询
    _TERMINAL_STATUSES = frozenset({"completed", "failed"})

    async def stream_events(self, session_id: str) -> AsyncIterator[bytes]:
        """SSE：轮询新事件 seq > last；session 进入终态后自动结束。"""
        last = await self.event_repo.get_max_seq(session_id)
        idle_rounds = 0
        try:
            while True:
                rows, _ = await self.event_repo.list_after_seq(
                    session_id, after_seq=last, limit=50
                )
                if rows:
                    idle_rounds = 0
                    for row in rows:
                        last = row["seq"]
                        payload = {
                            "sessionId": session_id,
                            "seq": row["seq"],
                            "eventType": row["eventType"],
                            "eventId": str(row["_id"]),
                            "display": row.get("display"),
                            "createdAt": row["createdAt"].isoformat() + "Z"
                            if hasattr(row["createdAt"], "isoformat")
                            else str(row["createdAt"]),
                        }
                        line = f"event: runtime_event\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                        yield line.encode("utf-8")
                else:
                    idle_rounds += 1

                # 每隔几轮空闲检查 session 状态，终态则发送结束标记并退出
                if idle_rounds >= 3:
                    idle_rounds = 0
                    session = await self.session_repo.find_by_id(session_id)
                    if session and session.get("status") in self._TERMINAL_STATUSES:
                        end_line = "event: runtime_done\ndata: {\"status\":\"" + session["status"] + "\"}\n\n"
                        yield end_line.encode("utf-8")
                        return

                await asyncio.sleep(0.4)
        except asyncio.CancelledError:
            raise
