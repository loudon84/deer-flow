from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from studio.domain.runtime.adapters.base import RuntimeAdapter
from studio.settings import StudioSettings

logger = logging.getLogger(__name__)


def _runtime_error_if_gateway_404(resp: httpx.Response, url: str, base_url: str) -> None:
    """当 Gateway/上游服务缺少对应路由时，返回更可操作的报错信息。"""
    if resp.status_code != 404:
        return
    raise RuntimeError(
        f"DeerFlow Gateway 返回 404: {resp.request.method} {url}\n"
        "这通常意味着两种情况：\n"
        "1) STUDIO_DEERFLOW_BASE_URL 指到了错误的服务/反代（不是 DeerFlow Gateway 或 path 前缀不一致）\n"
        "2) 你运行的 DeerFlow Gateway 版本/配置未暴露 Studio 运行时需要的接口（例如 POST /api/threads、"
        "POST /api/threads/{thread_id}/runs/stream 等）\n"
        f"自检: 访问 {base_url}/health 应包含 \"service\":\"deer-flow-gateway\"；\n"
        f"再访问 {base_url}/openapi.json，确认 paths 中是否存在 /api/threads 以及 "
        "/api/threads/{thread_id}/runs/stream。\n"
        "如果 /health 正常但 openapi 缺少这些路由，请升级/更换 Gateway 部署（或启用对应 runtime 路由模块）。"
    ) from None


def _normalize_context(request_context: dict[str, Any]) -> dict[str, Any]:
    """
    将 Studio 存储的 requestContext（camelCase 或 snake_case）转为 DeerFlow / LangGraph 运行时 context。

    约定：
    - 保留原始键（便于向后兼容），同时写入 snake_case 规范键给 DeerFlow 使用
    - 允许透传额外字段（如 agent_name）
    """
    ctx: dict[str, Any] = dict(request_context or {})

    if "agentName" in request_context and "agent_name" not in ctx:
        ctx["agent_name"] = request_context["agentName"]
    if "agent_name" in request_context:
        ctx["agent_name"] = request_context["agent_name"]

    if "modelName" in request_context:
        ctx["model_name"] = request_context["modelName"]
    elif "model_name" in request_context:
        ctx["model_name"] = request_context["model_name"]

    if "mode" in request_context:
        ctx["mode"] = request_context["mode"]

    if "reasoningEffort" in request_context:
        ctx["reasoning_effort"] = request_context["reasoningEffort"]
    elif "reasoning_effort" in request_context:
        ctx["reasoning_effort"] = request_context["reasoning_effort"]

    if "thinkingEnabled" in request_context:
        ctx["thinking_enabled"] = request_context["thinkingEnabled"]
    elif "thinking_enabled" in request_context:
        ctx["thinking_enabled"] = request_context["thinking_enabled"]

    if "planMode" in request_context:
        ctx["is_plan_mode"] = bool(request_context["planMode"])
    elif "plan_mode" in request_context:
        ctx["is_plan_mode"] = bool(request_context["plan_mode"])
    elif "is_plan_mode" in request_context:
        ctx["is_plan_mode"] = bool(request_context["is_plan_mode"])

    if "subagentEnabled" in request_context:
        ctx["subagent_enabled"] = request_context["subagentEnabled"]
    elif "subagent_enabled" in request_context:
        ctx["subagent_enabled"] = request_context["subagent_enabled"]

    return ctx


class DeerFlowAdapter(RuntimeAdapter):
    """通过 HTTP 调用 DeerFlow Gateway（/api/threads 等）。"""

    def __init__(self, *, base_url: str | None = None, timeout_seconds: float = 300.0) -> None:
        settings = StudioSettings()
        self.base_url = (base_url or settings.deerflow_base_url).rstrip("/")
        self.timeout_seconds = timeout_seconds

    def _langgraph_url(self, path: str) -> str:
        """
        Nginx 本地开发配置通常将 /api/langgraph/* rewrite 到 /* 并转发至 LangGraph(2024)。
        因此 Studio 若直接打到 Nginx(2026)，可通过 /api/langgraph/<path> 访问 LangGraph API。
        """
        return f"{self.base_url}/api/langgraph/{path.lstrip('/')}"

    async def create_thread(self) -> str:
        url = self._langgraph_url("/threads")
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post(url, json={})
            resp.raise_for_status()
            data = resp.json()
            tid = data.get("thread_id") or data.get("thread", {}).get("thread_id")
            if not tid:
                raise RuntimeError(f"unexpected create_thread response: {data}")
            return str(tid)

    async def start_run_stream(
        self,
        *,
        thread_id: str,
        message: str,
        request_context: dict[str, Any],
        assistant_id: str,
    ) -> AsyncIterator[dict[str, Any]]:
        ctx = _normalize_context(request_context)
        ctx["thread_id"] = thread_id
        payload: dict[str, Any] = {
            "input": {
                "messages": [
                    {
                        "type": "human",
                        "content": [{"type": "text", "text": message}],
                        "additional_kwargs": {},
                    }
                ]
            },
            "config": {"recursion_limit": 1000},
            "context": ctx,
            "stream_mode": ["updates", "custom"],
            "stream_subgraphs": False,
            "stream_resumable": True,
            "assistant_id": assistant_id,
            "on_disconnect": "continue",
        }
        url = f"{self.base_url}/api/threads/{thread_id}/runs/stream"
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", url, json=payload) as resp:
                if resp.status_code == 404:
                    lg_url = self._langgraph_url(f"/threads/{thread_id}/runs/stream")
                    async with client.stream("POST", lg_url, json=payload) as lg_resp:
                        lg_resp.raise_for_status()
                        async for frame in self._iter_sse_frames(lg_resp):
                            yield frame
                    return

                _runtime_error_if_gateway_404(resp, url, self.base_url)
                resp.raise_for_status()
                async for frame in self._iter_sse_frames(resp):
                    yield frame

    async def resume_run_stream(
        self,
        *,
        thread_id: str,
        resume_value: Any,
        assistant_id: str,
    ) -> AsyncIterator[dict[str, Any]]:
        payload: dict[str, Any] = {
            "input": {"command": {"resume": resume_value}},
            "config": {"recursion_limit": 1000},
            "stream_mode": ["updates", "custom"],
            "stream_subgraphs": False,
            "stream_resumable": True,
            "assistant_id": assistant_id,
            "on_disconnect": "continue",
        }
        url = f"{self.base_url}/api/threads/{thread_id}/runs/stream"
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", url, json=payload) as resp:
                if resp.status_code == 404:
                    lg_url = self._langgraph_url(f"/threads/{thread_id}/runs/stream")
                    async with client.stream("POST", lg_url, json=payload) as lg_resp:
                        lg_resp.raise_for_status()
                        async for frame in self._iter_sse_frames(lg_resp):
                            yield frame
                    return

                _runtime_error_if_gateway_404(resp, url, self.base_url)
                resp.raise_for_status()
                async for frame in self._iter_sse_frames(resp):
                    yield frame

    @staticmethod
    async def _iter_sse_frames(resp: httpx.Response) -> AsyncIterator[dict[str, Any]]:
        """将 SSE 流的 event:/data: 行配对后 yield 结构化帧。

        yield 格式: {"sse_event": "updates"|"custom"|"error"|"end"|...,
                     "raw_line": "data: {...}"}

        - event: 行仅保存类型，不单独 yield
        - data: 行携带 sse_event 类型一起 yield，供 mapper 精确判断
        - SSE 注释行（: 开头）和空行被跳过
        """
        current_event: str | None = None
        async for line in resp.aiter_lines():
            if not line:
                continue
            stripped = line.strip()
            if not stripped or stripped.startswith(":"):
                current_event = None
                continue
            if stripped.startswith("event:"):
                current_event = stripped[6:].strip()
                continue
            if stripped.startswith("data:"):
                yield {"sse_event": current_event, "raw_line": line}
                current_event = None
                continue
            # 其他行（如 id: 行）跳过
            current_event = None

    async def get_thread_state(self, *, thread_id: str) -> dict[str, Any]:
        # 直接走 LangGraph API（经 Nginx 前缀 /api/langgraph/）
        url = self._langgraph_url(f"/threads/{thread_id}/state")
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    async def get_thread_history(self, *, thread_id: str, limit: int = 20) -> list[dict[str, Any]]:
        # 直接走 LangGraph API（经 Nginx 前缀 /api/langgraph/）
        url = self._langgraph_url(f"/threads/{thread_id}/history")
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post(
                url,
                json={"limit": min(limit, 100), "before": None},
            )
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else []

    async def fetch_json_sse_payload(self, raw_line: str) -> dict[str, Any] | None:
        """解析单行 SSE，提取 data JSON（供 mapper 复测）。"""
        line = raw_line.strip()
        if not line or line.startswith(":"):
            return None
        if line.startswith("event:"):
            return None
        if line.startswith("data:"):
            raw = line[5:].strip()
            if raw == "[DONE]":
                return {"event": "done", "done": True}
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                logger.debug("non-json sse data: %s", raw[:200])
                return {"parse_error": True, "raw": raw}
        return None

    async def get_artifact_content(
        self,
        *,
        thread_id: str,
        artifact_path: str,
    ) -> str | None:
        """通过 Gateway API 获取 artifact 文件内容。

        Args:
            thread_id: 线程 ID
            artifact_path: 虚拟路径，如 "mnt/user-data/outputs/article.md"
                          （注意：不含前导斜杠，与 Gateway API 路径参数一致）

        Returns:
            文件内容字符串，如果文件不存在或获取失败则返回 None
        """
        # Gateway API: GET /api/threads/{thread_id}/artifacts/{path}
        url = f"{self.base_url}/api/threads/{thread_id}/artifacts/{artifact_path}"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                resp = await client.get(url)
                if resp.status_code == 404:
                    return None
                resp.raise_for_status()
                return resp.text
            except httpx.HTTPError as e:
                logger.warning("Failed to fetch artifact %s: %s", artifact_path, e)
                return None

    async def list_output_artifacts(
        self,
        *,
        thread_id: str,
    ) -> list[str]:
        """获取 thread state 中的 artifacts 列表。

        从 thread state 的 values.artifacts 中提取文件路径列表。

        Args:
            thread_id: 线程 ID

        Returns:
            artifacts 路径列表，如 ["/mnt/user-data/outputs/article.md", ...]
        """
        state = await self.get_thread_state(thread_id=thread_id)
        values = state.get("values") or {}
        artifacts = values.get("artifacts") or []
        return artifacts if isinstance(artifacts, list) else []
