from __future__ import annotations

import os
from typing import Any, Type

import httpx
from langchain.tools import BaseTool
from pydantic import BaseModel, Field, field_validator

DEFAULT_DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
DEFAULT_TIMEOUT_SECONDS = 120


class DoubaoWriterInput(BaseModel):
    prompt: str = Field(..., min_length=1, description="用户写作指令")
    system_prompt: str | None = Field(default=None, description="可选系统提示")
    temperature: float = Field(default=0.7, ge=0.0, le=1.5)
    # Ark chat completions supports large `max_tokens` on some models; keep validation permissive.
    max_tokens: int = Field(default=2048, ge=128, le=131072)

    @field_validator("prompt")
    @classmethod
    def _validate_prompt(cls, v: str) -> str:
        vv = v.strip()
        if not vv:
            raise ValueError("prompt must be non-empty after stripping whitespace")
        return vv

    @field_validator("system_prompt")
    @classmethod
    def _validate_system_prompt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        vv = v.strip()
        return vv or None


class DoubaoWriterTool(BaseTool):
    name: str = "doubao_writer_tool"
    description: str = (
        "用于调用 Doubao 生成中文文章、营销文案、润色改写结果。"
        "适用于文章生成、文案优化、段落扩写、总结改写。"
    )
    args_schema: Type[BaseModel] = DoubaoWriterInput

    def _run(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **_: Any,
    ) -> str:
        api_key = os.getenv("DOUBAO_API_KEY")
        model = os.getenv("DOUBAO_MODEL")
        base_url = os.getenv("DOUBAO_BASE_URL", DEFAULT_DOUBAO_BASE_URL)
        timeout_raw = os.getenv("DOUBAO_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS))

        if not api_key:
            return "DOUBAO_ERROR: missing DOUBAO_API_KEY"
        if not model:
            return "DOUBAO_ERROR: missing DOUBAO_MODEL"

        try:
            timeout_seconds = int(timeout_raw)
        except Exception:
            timeout_seconds = DEFAULT_TIMEOUT_SECONDS

        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                response = client.post(base_url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not isinstance(content, str) or not content.strip():
                return "DOUBAO_ERROR: empty content returned by doubao api"

            return content.strip()
        except httpx.HTTPStatusError as exc:
            return f"DOUBAO_ERROR: http_status={exc.response.status_code}"
        except httpx.TimeoutException:
            return "DOUBAO_ERROR: request timeout"
        except Exception as exc:
            return f"DOUBAO_ERROR: {type(exc).__name__}: {exc}"


doubao_writer_tool = DoubaoWriterTool()

