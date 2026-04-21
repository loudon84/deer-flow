from __future__ import annotations

import json
from typing import Any


class RuntimeResultMapper:
    """从 Gateway thread state / history 中提取可落盘的文章结果。"""

    def from_thread_state(self, state: dict[str, Any]) -> dict[str, Any] | None:
        """尝试从 state.values 或顶层 messages 提取 title/content。"""
        values = state.get("values") or {}
        messages = values.get("messages") or state.get("messages")
        title = values.get("title")
        content: str | None = None
        if messages:
            content = self._last_ai_text(messages)
        if not content and isinstance(values.get("artifacts"), list):
            # 可选：从 artifacts 取文本
            pass
        if not content:
            return None
        return {
            "resultId": state.get("thread_id") or "derived",
            "resultType": "article_draft",
            "title": str(title) if title else "未命名",
            "content": content,
        }

    def from_history_entries(self, entries: list[dict[str, Any]]) -> dict[str, Any] | None:
        """取最近一条含 messages 的 checkpoint。"""
        for ent in reversed(entries):
            vals = ent.get("values") or {}
            msgs = vals.get("messages")
            if msgs:
                text = self._last_ai_text(msgs)
                if text:
                    return {
                        "resultId": ent.get("checkpoint_id") or "hist",
                        "resultType": "article_draft",
                        "title": str(vals.get("title") or "未命名"),
                        "content": text,
                    }
        return None

    def _last_ai_text(self, messages: Any) -> str | None:
        if not isinstance(messages, list):
            return None
        for m in reversed(messages):
            if isinstance(m, dict):
                t = m.get("type") or m.get("role")
                if t in ("ai", "assistant"):
                    c = m.get("content")
                    if isinstance(c, str):
                        return c
                    if isinstance(c, list):
                        parts = []
                        for block in c:
                            if isinstance(block, dict) and block.get("type") == "text":
                                parts.append(block.get("text", ""))
                        return "\n".join(parts) if parts else None
        return None

    def stable_json(self, obj: dict[str, Any]) -> str:
        return json.dumps(obj, ensure_ascii=False, sort_keys=True)
