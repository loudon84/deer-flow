from __future__ import annotations

import json
import logging
from typing import Any

from studio.models.persistence.runtime_constants import (
    RUNTIME_EVENT_CUSTOM_EVENT,
    RUNTIME_EVENT_ERROR,
    RUNTIME_EVENT_INTERRUPT,
    RUNTIME_EVENT_MESSAGE_DELTA,
    RUNTIME_EVENT_RUN_END,
    RUNTIME_EVENT_TOOL_CALL,
    RUNTIME_EVENT_TOOL_RESULT,
)

logger = logging.getLogger(__name__)

# LangGraph SSE event 类型 → 是否需要持久化
# - updates: 节点增量输出，核心事件，保留
# - custom: 用户自定义事件（如进度通知），保留
# - values: 全量状态快照，冗余且体积大，跳过
# - messages / messages-tuple: 消息流式块，跳过（由 updates 中的 messages 通道覆盖）
# - metadata: run 元数据，跳过
# - checkpoints / tasks / debug: 内部事件，跳过
# - events: Gateway 不支持，跳过
_PERSIST_SSE_EVENTS: frozenset[str] = frozenset({"updates", "custom"})

# updates 事件中已知的 LangGraph 通道/节点名模式
# 用于从 updates payload 中识别事件子类型
_TOOL_CALL_INDICATORS = frozenset({"tool_calls", "tool_call"})
_TOOL_RESULT_INDICATORS = frozenset({"tool_result", "tool_output"})


class DeerFlowEventMapper:
    """DeerFlow SSE 帧 → Portal 统一事件结构

    接收 adapter 产出的结构化 SSE 帧 {"sse_event": ..., "raw_line": ...}，
    利用 sse_event 类型做精确过滤和映射，避免启发式误判。
    """

    def parse_sse_frame(self, sse_event: str | None, raw_line: str) -> Any | None:
        """解析结构化 SSE 帧（由 adapter._iter_sse_frames 产出）。

        Args:
            sse_event: SSE event: 行的值（如 "updates", "custom", "error", "end"），
                       由 adapter 配对后传入，不再依赖内部状态追踪。
            raw_line: SSE data: 行的原始内容。

        Returns:
            解析后的 dict（含 sse_event 元信息），或 None（跳过）。
        """
        line = raw_line.strip()
        if not line or line.startswith(":") or line.startswith("event:"):
            return None

        if not line.startswith("data:"):
            return None

        raw = line[5:].strip()

        # [DONE] 标记 → run_end
        if raw == "[DONE]":
            return {"sse_event": "end", "event_type": RUNTIME_EVENT_RUN_END, "source": "system", "payload": {}}

        # 特殊处理：sse_event == "end" 时，无论 data 内容如何，都返回 run_end
        # DeerFlow Gateway 发送格式: event: end\ndata: null\n\n
        if sse_event == "end":
            return {"sse_event": "end", "event_type": RUNTIME_EVENT_RUN_END, "source": "system", "payload": {}}

        # 按 sse_event 类型过滤：只保留需要持久化的类型
        if sse_event and sse_event not in _PERSIST_SSE_EVENTS:
            # 特殊处理：error 类型虽然不在 _PERSIST_SSE_EVENTS 中，但需要保留
            if sse_event not in ("error",):
                return None

        # 解析 JSON
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            # 非 JSON 的 custom 事件
            if sse_event == "custom":
                return {"sse_event": sse_event, "event_type": RUNTIME_EVENT_CUSTOM_EVENT, "source": "system", "payload": {"raw": raw}}
            logger.debug("non-json sse data (event=%s): %s", sse_event, raw[:200])
            return None

        # 将 sse_event 元信息注入 parsed，供 to_portal_event 使用
        if isinstance(parsed, dict):
            parsed["__sse_event__"] = sse_event
        return parsed

    def to_portal_event(self, parsed: Any, seq: int) -> dict[str, Any]:
        """将解析后的 JSON 映射为写入 Mongo 的 portal event 结构。"""
        if not isinstance(parsed, dict):
            parsed = {"event_type": RUNTIME_EVENT_CUSTOM_EVENT, "source": "system", "payload": parsed}

        # 提取 adapter 注入的 SSE event 类型
        sse_event = parsed.pop("__sse_event__", None)

        # 优先识别内置事件类型（由 parse_sse_frame 直接产出的 run_end / error）
        if parsed.get("event_type") == RUNTIME_EVENT_RUN_END or sse_event == "end":
            return self._build_event(
                seq=seq, event_type=RUNTIME_EVENT_RUN_END, source="system",
                title="执行完成", content="运行已结束", severity="success",
                raw_event=parsed,
            )

        if sse_event == "error" or parsed.get("event") == "error" or parsed.get("error"):
            return self._build_event(
                seq=seq, event_type=RUNTIME_EVENT_ERROR, source="system",
                title="运行错误", content=str(parsed.get("data", parsed))[:2000], severity="error",
                raw_event=parsed,
            )

        # 提取 payload
        payload: Any = parsed.get("payload")
        if payload is None:
            payload = parsed.get("data", parsed)

        # HITL / interrupt 检测
        intr = self._extract_interrupt(payload)
        if intr is not None:
            return self._build_event(
                seq=seq, event_type=RUNTIME_EVENT_INTERRUPT, source="system",
                title="等待人工处理", content=str(intr)[:8000], severity="warning",
                raw_event=parsed,
            )

        # 根据 sse_event 类型做精确映射
        if sse_event == "updates":
            return self._map_updates_event(parsed, payload, seq)

        if sse_event == "custom":
            return self._map_custom_event(parsed, payload, seq)

        # 兜底：无法识别的事件类型
        return self._build_event(
            seq=seq, event_type=RUNTIME_EVENT_CUSTOM_EVENT, source="system",
            title="运行事件", content=self._truncate_payload(payload), severity="info",
            raw_event=parsed,
        )

    # ── updates 事件映射 ──────────────────────────────────────────

    def _map_updates_event(self, parsed: dict, payload: Any, seq: int) -> dict[str, Any]:
        """映射 updates 类型的 SSE 事件。

        LangGraph updates 格式: {node_name: {channel: value}}
        需要根据 payload 内容识别子类型（message_delta / tool_call / tool_result / custom）。
        """
        if not isinstance(payload, dict):
            return self._build_event(
                seq=seq, event_type=RUNTIME_EVENT_CUSTOM_EVENT, source="system",
                title="节点输出", content=self._truncate_payload(payload), severity="info",
                raw_event=parsed,
            )

        # updates payload 的顶层 key 是节点名
        node_names = [k for k in payload if not k.startswith("__")]
        if not node_names:
            return self._build_event(
                seq=seq, event_type=RUNTIME_EVENT_CUSTOM_EVENT, source="system",
                title="运行事件", content=self._truncate_payload(payload), severity="info",
                raw_event=parsed,
            )

        # 检查是否包含 messages 通道 → message_delta
        for node_name in node_names:
            node_output = payload[node_name]
            if isinstance(node_output, dict) and "messages" in node_output:
                msgs = node_output["messages"]
                text = self._extract_last_ai_text(msgs)
                if text:
                    return self._build_event(
                        seq=seq, event_type=RUNTIME_EVENT_MESSAGE_DELTA, source="assistant",
                        title="Assistant 输出", content=text[:2000], severity="info",
                        raw_event=self._slim_raw_event(parsed, node_name),
                    )

        # 检查是否包含 tool_calls → tool_call
        for node_name in node_names:
            node_output = payload[node_name]
            if isinstance(node_output, dict):
                if any(k in node_output for k in _TOOL_CALL_INDICATORS):
                    return self._build_event(
                        seq=seq, event_type=RUNTIME_EVENT_TOOL_CALL, source="tool",
                        title="工具调用", content=self._truncate_payload(node_output), severity="info",
                        raw_event=self._slim_raw_event(parsed, node_name),
                    )
                if any(k in node_output for k in _TOOL_RESULT_INDICATORS):
                    return self._build_event(
                        seq=seq, event_type=RUNTIME_EVENT_TOOL_RESULT, source="tool",
                        title="工具结果", content=self._truncate_payload(node_output), severity="info",
                        raw_event=self._slim_raw_event(parsed, node_name),
                    )

        # 其他 updates → custom_event，附带节点名
        primary_node = node_names[0]
        return self._build_event(
            seq=seq, event_type=RUNTIME_EVENT_CUSTOM_EVENT, source="system",
            title=f"节点: {primary_node}", content=self._truncate_payload(payload), severity="info",
            raw_event=self._slim_raw_event(parsed, primary_node),
        )

    # ── custom 事件映射 ──────────────────────────────────────────

    def _map_custom_event(self, parsed: dict, payload: Any, seq: int) -> dict[str, Any]:
        """映射 custom 类型的 SSE 事件（用户通过 StreamWriter 写入的自定义数据）。"""
        if isinstance(payload, dict):
            # 自定义事件可能携带 type/status 等语义字段
            evt_type = payload.get("type", "")
            if evt_type == "progress":
                title = "进度更新"
            elif evt_type == "thinking":
                title = "思考中"
            elif evt_type == "error":
                return self._build_event(
                    seq=seq, event_type=RUNTIME_EVENT_ERROR, source="system",
                    title="运行错误", content=str(payload.get("message", payload))[:2000], severity="error",
                    raw_event=parsed,
                )
            else:
                title = "自定义事件"
            content = self._truncate_payload(payload)
        else:
            title = "自定义事件"
            content = str(payload)[:1000]

        return self._build_event(
            seq=seq, event_type=RUNTIME_EVENT_CUSTOM_EVENT, source="system",
            title=title, content=content, severity="info",
            raw_event=parsed,
        )

    # ── 辅助方法 ────────────────────────────────────────────────

    @staticmethod
    def _build_event(
        *,
        seq: int,
        event_type: str,
        source: str,
        title: str,
        content: str | None,
        severity: str,
        raw_event: Any,
    ) -> dict[str, Any]:
        return {
            "seq": seq,
            "event_type": event_type,
            "source": source,
            "display": {"title": title, "content": content, "severity": severity},
            "raw_event": raw_event,
        }

    @staticmethod
    def _extract_interrupt(payload: Any) -> Any | None:
        """从 payload 中提取 interrupt 信息。"""
        if not isinstance(payload, dict):
            return None
        if "interrupt" in payload:
            return payload["interrupt"]
        if "__interrupt__" in payload:
            return payload["__interrupt__"]
        return None

    @staticmethod
    def _extract_last_ai_text(messages: Any) -> str | None:
        """从 messages 列表中提取最后一条 AI 消息的文本。"""
        if not isinstance(messages, list) or not messages:
            return None
        for m in reversed(messages):
            if not isinstance(m, dict):
                continue
            msg_type = m.get("type") or m.get("role", "")
            if msg_type in ("ai", "assistant"):
                content = m.get("content")
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    parts = []
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            parts.append(block.get("text", ""))
                    return "\n".join(parts) if parts else None
        return None

    @staticmethod
    def _truncate_payload(payload: Any, limit: int = 1000) -> str:
        """将 payload 截断为可存储的字符串。"""
        if isinstance(payload, dict):
            return json.dumps(payload, ensure_ascii=False, default=str)[:limit]
        return str(payload)[:limit]

    @staticmethod
    def _slim_raw_event(parsed: dict, node_name: str) -> dict[str, Any]:
        """为 raw_event 生成精简版本，避免存储完整 messages 导致数据膨胀。

        保留节点名和输出结构摘要，但截断大体积字段（如 messages 列表）。
        """
        slim: dict[str, Any] = {}
        for k, v in parsed.items():
            if k.startswith("__"):
                continue
            if isinstance(v, dict) and k == node_name:
                slim[k] = {}
                for ck, cv in v.items():
                    if ck == "messages" and isinstance(cv, list):
                        # 只保留消息数量和最后一条消息的摘要
                        slim[k][ck] = f"[{len(cv)} messages, last truncated]"
                    else:
                        slim[k][ck] = cv
            else:
                slim[k] = v
        return slim

    # ── 兼容旧接口 ──────────────────────────────────────────────

    def parse_sse_line(self, raw_line: str) -> Any | None:
        """兼容旧调用方式：逐行解析（不推荐，优先使用 parse_sse_frame）。

        保留此方法以兼容未迁移的调用方，但内部仍使用 _current_sse_event 状态追踪。
        """
        line = raw_line.strip()
        if not line or line.startswith(":"):
            return None
        if line.startswith("event:"):
            self._current_sse_event = line[6:].strip()
            return None
        if line.startswith("data:"):
            # 委托给 parse_sse_frame
            result = self.parse_sse_frame(self._current_sse_event, raw_line)
            self._current_sse_event = None
            return result
        return None

    # 旧接口兼容：_current_sse_event 状态
    _current_sse_event: str | None = None
