from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any


class RuntimeAdapter(ABC):
    """对接 DeerFlow Gateway 的运行时适配器抽象"""

    @abstractmethod
    async def create_thread(self) -> str:
        raise NotImplementedError

    @abstractmethod
    async def start_run_stream(
        self,
        *,
        thread_id: str,
        message: str,
        request_context: dict[str, Any],
        assistant_id: str,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式运行：逐行产出 SSE 行解析前的载荷（如 {"raw_line": "..."}）"""
        raise NotImplementedError
        yield  # pragma: no cover

    @abstractmethod
    async def resume_run_stream(
        self,
        *,
        thread_id: str,
        resume_value: Any,
        assistant_id: str,
    ) -> AsyncIterator[dict[str, Any]]:
        raise NotImplementedError
        yield  # pragma: no cover

    @abstractmethod
    async def get_thread_state(self, *, thread_id: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def get_thread_history(self, *, thread_id: str, limit: int = 20) -> list[dict[str, Any]]:
        raise NotImplementedError
