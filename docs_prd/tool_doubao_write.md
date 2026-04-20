《Doubao Tool 功能文档（Spec Coding 执行稿）》
1. 文档定位

本文档用于直接驱动 Cursor 按 Spec Coding 范式实现 DeerFlow 的 doubao_writer_tool。

本文档定义：

文件级代码骨架
输入输出契约
环境变量契约
错误处理契约
测试约束
2. 实现目标

在 DeerFlow 内新增一个可配置的写作 Tool：

名称：doubao_writer_tool
作用：调用 Doubao Chat Completions API 生成中文内容
装配方式：通过 config.yaml -> tools[] -> use: 引入
运行位置：Harness 层 deerflow.community.tools
3. 文件级实现清单
backend/packages/harness/deerflow/community/tools/
├── __init__.py
└── doubao_writer.py

backend/tests/
└── test_doubao_writer_tool.py
4. 代码约束
4.1 命名约束
模块文件名：doubao_writer.py
Tool 实例变量名：doubao_writer_tool
Tool 名称：doubao_writer_tool
4.2 依赖约束

允许依赖：

os
json
typing
httpx
pydantic
langchain_core.tools

禁止依赖：

app.*
DeerFlow 前端代码
任意数据库客户端
任意 Façade / 外部平台 SDK
5. 输入输出契约
5.1 Tool 输入

Tool 只接受一个结构化输入模型：

class DoubaoWriterInput(BaseModel):
    prompt: str
    system_prompt: str | None = None
    temperature: float = 0.7
    max_tokens: int = 2048
字段约束
字段	类型	必填	规则
prompt	str	是	非空，去首尾空白后长度 > 0
system_prompt	str | None	否	可选系统提示
temperature	float	否	0.0 ~ 1.5
max_tokens	int	否	128 ~ 8192
5.2 Tool 输出

Tool 输出统一为字符串，不返回 dict，不返回 bytes。

返回内容：

成功：Doubao 生成的正文文本
失败：带前缀的错误字符串，例如 DOUBAO_ERROR: ...

原因：

与 DeerFlow Tool 体系的常见文本输出风格保持一致
便于直接被 Agent 消费
6. 环境变量契约
DOUBAO_API_KEY=
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
DOUBAO_MODEL=ep-xxxxxx
DOUBAO_TIMEOUT_SECONDS=120
规则
DOUBAO_API_KEY 必填，缺失则 Tool 返回配置错误
DOUBAO_BASE_URL 可选，缺失时使用默认值
DOUBAO_MODEL 必填，缺失则 Tool 返回配置错误
DOUBAO_TIMEOUT_SECONDS 可选，默认 120
7. 对外请求契约
7.1 请求方法
POST {DOUBAO_BASE_URL}
7.2 请求头
Authorization: Bearer {DOUBAO_API_KEY}
Content-Type: application/json
7.3 请求体
{
  "model": "ep-xxxxxx",
  "messages": [
    {"role": "system", "content": "你是一个专业中文写作助手"},
    {"role": "user", "content": "请根据以下资料生成产品文章 ..."}
  ],
  "temperature": 0.7,
  "max_tokens": 2048
}
8. 代码骨架
8.1 backend/packages/harness/deerflow/community/tools/doubao_writer.py
from __future__ import annotations

import os
from typing import Type

import httpx
from pydantic import BaseModel, Field, ValidationError
from langchain_core.tools import BaseTool


DEFAULT_DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
DEFAULT_TIMEOUT_SECONDS = 120


class DoubaoWriterInput(BaseModel):
    prompt: str = Field(..., min_length=1, description="用户写作指令")
    system_prompt: str | None = Field(default=None, description="可选系统提示")
    temperature: float = Field(default=0.7, ge=0.0, le=1.5)
    max_tokens: int = Field(default=2048, ge=128, le=8192)


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
    ) -> str:
        api_key = os.getenv("DOUBAO_API_KEY")
        model = os.getenv("DOUBAO_MODEL")
        base_url = os.getenv("DOUBAO_BASE_URL", DEFAULT_DOUBAO_BASE_URL)
        timeout_seconds = int(os.getenv("DOUBAO_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)))

        if not api_key:
            return "DOUBAO_ERROR: missing DOUBAO_API_KEY"

        if not model:
            return "DOUBAO_ERROR: missing DOUBAO_MODEL"

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

            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )

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
8.2 backend/packages/harness/deerflow/community/tools/__init__.py
from deerflow.community.tools.doubao_writer import doubao_writer_tool

__all__ = ["doubao_writer_tool"]
9. config.yaml 接入片段
tools:
  - use: deerflow.community.tools.doubao_writer:doubao_writer_tool
    group: writing
10. 测试文档
10.1 测试文件
backend/tests/test_doubao_writer_tool.py
10.2 必测场景
场景 1：缺少 API Key

输入：

未设置 DOUBAO_API_KEY

期望：

返回 DOUBAO_ERROR: missing DOUBAO_API_KEY
场景 2：缺少模型 ID

输入：

已设置 DOUBAO_API_KEY
未设置 DOUBAO_MODEL

期望：

返回 DOUBAO_ERROR: missing DOUBAO_MODEL
场景 3：接口正常返回

Mock：

httpx.Client.post() 返回 200
JSON 含 choices[0].message.content

期望：

Tool 返回正文字符串
场景 4：接口超时

Mock：

httpx.TimeoutException

期望：

返回 DOUBAO_ERROR: request timeout
场景 5：接口返回空内容

Mock：

200
content 为空字符串

期望：

返回 DOUBAO_ERROR: empty content returned by doubao api
10.3 测试骨架
import os

from deerflow.community.tools.doubao_writer import doubao_writer_tool


def test_doubao_writer_returns_error_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("DOUBAO_API_KEY", raising=False)
    monkeypatch.setenv("DOUBAO_MODEL", "ep-test")

    result = doubao_writer_tool.invoke({"prompt": "写一段产品介绍"})
    assert result == "DOUBAO_ERROR: missing DOUBAO_API_KEY"
11. 非功能约束
11.1 超时

默认 120 秒，禁止无限等待。

11.2 幂等

本 Tool 不做服务端幂等控制；相同 prompt 可重复生成。

11.3 日志

首期不在 Tool 内做复杂日志埋点，只返回明确错误字符串。避免把 API Key、prompt 原文写入日志。

11.4 安全

禁止把以下内容拼入错误输出：

API Key
完整请求头
完整返回包
用户敏感上下文
12. 后续增强点（二期，不纳入本次实现）
支持流式输出
支持 outline → section 分段生成
支持 markdown / html 输出模式
支持多模板写作
支持重试与退避
支持 Tool 级 prompt 模板库
支持 Doubao 与主模型协同的写作路由策略
13. 最终实施原则

本次改造只做两件事：

在 DeerFlow Harness 层增加一个可被 config.yaml 引用的 BaseTool 实例
通过 tools[] 配置把该 Tool 暴露给 Agent

不要改：

主模型工厂
中间件顺序
Gateway API
MCP 管理逻辑
前端页面