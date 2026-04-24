## LangGraph API 完整接口说明

Base URL: `/api/langgraph`（通过 Nginx 端口 2026 代理到 LangGraph Server 端口 2024） [1](#2-0) 

---

### 1. 创建线程

```http
POST /api/langgraph/threads
Content-Type: application/json
```

**Request Body:**
```json
{ "metadata": {} }
```

**Response:**
```json
{
  "thread_id": "abc123",
  "created_at": "2024-01-15T10:30:00Z",
  "metadata": {}
}
``` [2](#2-1) 

---

### 2. 获取线程状态

```http
GET /api/langgraph/threads/{thread_id}/state
```

**Response — 完整结构（基于真实 thread.json）：**

```json
{
  "values": {
    "messages": [ /* 见下方 Message 类型说明 */ ],
    "sandbox": {
      "sandbox_id": "string | null"
    },
    "thread_data": {
      "workspace_path": "/path/to/.deer-flow/threads/{id}/user-data/workspace",
      "uploads_path":   "/path/to/.deer-flow/threads/{id}/user-data/uploads",
      "outputs_path":   "/path/to/.deer-flow/threads/{id}/user-data/outputs"
    },
    "uploaded_files": [],
    "title": "Conversation Title",
    "artifacts": ["/mnt/user-data/outputs/index.html"]
  },
  "next": [],
  "tasks": [],
  "metadata": {
    "model_name": "gpt-4",
    "thinking_enabled": false,
    "is_plan_mode": false,
    "graph_id": "lead_agent",
    "assistant_id": "...",
    "thread_id": "...",
    "run_id": "...",
    "run_attempt": 1,
    "langgraph_version": "1.0.6",
    "langgraph_api_version": "0.6.38",
    "source": "loop",
    "step": 15
  },
  "created_at": "2026-01-28T04:13:14.394777+00:00",
  "checkpoint": {
    "checkpoint_id": "...",
    "thread_id": "...",
    "checkpoint_ns": ""
  },
  "parent_checkpoint": {
    "checkpoint_id": "...",
    "thread_id": "...",
    "checkpoint_ns": ""
  },
  "interrupts": [],
  "checkpoint_id": "...",
  "parent_checkpoint_id": "..."
}
``` [3](#2-2) 

#### `values.messages` 中的消息类型

`ThreadState` 中的 `messages` 字段继承自 `AgentState`，包含四种消息类型： [4](#2-3) 

**① human（用户消息）**
```json
{
  "type": "human",
  "id": "uuid",
  "name": null,
  "content": "string 或 [{\"type\": \"text\", \"text\": \"...\"}]",
  "additional_kwargs": {},
  "response_metadata": {}
}
```

**② system（系统注入消息，如上传文件列表）**
```json
{
  "type": "system",
  "id": "uuid",
  "name": null,
  "content": "<uploaded_files>...</uploaded_files>",
  "additional_kwargs": {},
  "response_metadata": {}
}
```

**③ ai（模型回复消息）**
```json
{
  "type": "ai",
  "id": "lc_run--...",
  "name": null,
  "content": "string",
  "additional_kwargs": {},
  "response_metadata": {
    "finish_reason": "stop | tool_calls",
    "model_name": "kimi-k2.5",
    "system_fingerprint": "...",
    "model_provider": "openai"
  },
  "tool_calls": [
    {
      "name": "write_file",
      "args": { "path": "...", "content": "..." },
      "id": "write_file:1",
      "type": "tool_call"
    }
  ],
  "invalid_tool_calls": [],
  "usage_metadata": null
}
```

**④ tool（工具调用结果）**
```json
{
  "type": "tool",
  "id": "uuid",
  "name": "write_file",
  "content": "OK",
  "tool_call_id": "write_file:1",
  "artifact": null,
  "status": "success",
  "additional_kwargs": {},
  "response_metadata": {}
}
``` [5](#2-4) 

#### `ThreadState` 字段定义（Python 源码）

| 字段 | 类型 | 说明 |
|------|------|------|
| `messages` | `list[BaseMessage]` | 对话消息列表（继承自 AgentState） |
| `sandbox` | `SandboxState \| None` | 沙箱环境信息（含 `sandbox_id`） |
| `thread_data` | `ThreadDataState \| None` | 线程目录路径（workspace/uploads/outputs） |
| `title` | `str \| None` | 自动生成的对话标题 |
| `artifacts` | `list[str]` | 生成的文件路径列表（去重合并） |
| `todos` | `list \| None` | 任务列表（plan_mode 下使用） |
| `uploaded_files` | `list[dict] \| None` | 已上传文件列表 |
| `viewed_images` | `dict[str, ViewedImageData]` | 视觉模型图片数据（`image_path → {base64, mime_type}`） | [6](#2-5) 

---

### 3. 创建运行（SSE 流式）

```http
POST /api/langgraph/threads/{thread_id}/runs
Content-Type: application/json
```

**Request Body:**
```json
{
  "input": {
    "messages": [
      { "role": "user", "content": "Hello" }
    ]
  },
  "config": {
    "recursion_limit": 100,
    "configurable": {
      "model_name": "gpt-4",
      "thinking_enabled": false,
      "is_plan_mode": false,
      "subagent_enabled": false,
      "reasoning_effort": "medium"
    }
  },
  "stream_mode": ["values", "messages-tuple", "custom"]
}
```

**`config.configurable` 参数说明：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `model_name` | string | 覆盖默认模型 |
| `thinking_enabled` | boolean | 启用扩展思考（支持的模型） |
| `is_plan_mode` | boolean | 启用 TodoList 中间件任务追踪 |
| `subagent_enabled` | boolean | 启用子代理任务委托 |
| `reasoning_effort` | string | 推理强度：`minimal/low/medium/high` |

**`stream_mode` 可用值：** `values`, `messages-tuple`, `custom`, `updates`, `events`, `debug`, `tasks`, `checkpoints`
> 注意：`tools` 已废弃，会触发 schema 验证错误

**Response — SSE 事件流：**
```
event: values
data: {"messages": [...], "title": "...", "artifacts": [...]}

event: messages
data: {"content": "Hello! I'd be happy to help.", "role": "assistant"}

event: end
data: {}
``` [7](#2-6) 

> **重要**：直接调用 LangGraph API 时，`recursion_limit` 默认为 **25**，对于 plan_mode 或子代理场景会触发 `GraphRecursionError`。建议显式设置为 `100`（与 Gateway 默认值一致）。 [8](#2-7) 

---

### 4. 获取运行历史

```http
GET /api/langgraph/threads/{thread_id}/runs
```

**Response:**
```json
{
  "runs": [
    {
      "run_id": "run123",
      "status": "success",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
``` [9](#2-8) 

---

### 5. 流式运行（专用端点）

```http
POST /api/langgraph/threads/{thread_id}/runs/stream
Content-Type: application/json
```

Request Body 与「创建运行」相同，直接返回 SSE 流。同时支持 WebSocket 连接：

```
ws://localhost:2026/api/langgraph/threads/{thread_id}/runs/stream
``` [10](#2-9) [11](#2-10) 

---

### 6. 删除线程（LangGraph 原生）

```http
DELETE /api/langgraph/threads/{thread_id}
```

删除 LangGraph 侧的线程状态和 checkpoint 数据。删除后还需调用 Gateway 的 `DELETE /api/threads/{thread_id}` 清理本地文件系统数据。 [12](#2-11) 

---

### 前端 SDK 类型定义

前端通过 `@langchain/langgraph-sdk` 消费这些接口，`AgentThreadState` 定义了客户端关心的核心字段： [13](#2-12) 

```typescript
interface AgentThreadState {
  title: string;
  messages: Message[];
  artifacts: string[];
  todos?: Todo[];
}

interface AgentThreadContext {
  thread_id: string;
  model_name: string | undefined;
  thinking_enabled: boolean;
  is_plan_mode: boolean;
  subagent_enabled: boolean;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  agent_name?: string;
}
```

### Citations

**File:** backend/docs/API.md (L14-18)
```markdown
## LangGraph API

Base URL: `/api/langgraph`

The LangGraph API is provided by the LangGraph server and follows the LangGraph SDK conventions.
```

**File:** backend/docs/API.md (L22-43)
```markdown
#### Create Thread

```http
POST /api/langgraph/threads
Content-Type: application/json
```

**Request Body:**
```json
{
  "metadata": {}
}
```

**Response:**
```json
{
  "thread_id": "abc123",
  "created_at": "2024-01-15T10:30:00Z",
  "metadata": {}
}
```
```

**File:** backend/docs/API.md (L66-135)
```markdown
### Runs

#### Create Run

Execute the agent with input.

```http
POST /api/langgraph/threads/{thread_id}/runs
Content-Type: application/json
```

**Request Body:**
```json
{
  "input": {
    "messages": [
      {
        "role": "user",
        "content": "Hello, can you help me?"
      }
    ]
  },
  "config": {
    "recursion_limit": 100,
    "configurable": {
      "model_name": "gpt-4",
      "thinking_enabled": false,
      "is_plan_mode": false
    }
  },
  "stream_mode": ["values", "messages-tuple", "custom"]
}
```

**Stream Mode Compatibility:**
- Use: `values`, `messages-tuple`, `custom`, `updates`, `events`, `debug`, `tasks`, `checkpoints`
- Do not use: `tools` (deprecated/invalid in current `langgraph-api` and will trigger schema validation errors)

**Recursion Limit:**

`config.recursion_limit` caps the number of graph steps LangGraph will execute
in a single run. The `/api/langgraph/*` endpoints go straight to the LangGraph
server and therefore inherit LangGraph's native default of **25**, which is
too low for plan-mode or subagent-heavy runs — the agent typically errors out
with `GraphRecursionError` after the first round of subagent results comes
back, before the lead agent can synthesize the final answer.

DeerFlow's own Gateway and IM-channel paths mitigate this by defaulting to
`100` in `build_run_config` (see `backend/app/gateway/services.py`), but
clients calling the LangGraph API directly must set `recursion_limit`
explicitly in the request body. `100` matches the Gateway default and is a
safe starting point; increase it if you run deeply nested subagent graphs.

**Configurable Options:**
- `model_name` (string): Override the default model
- `thinking_enabled` (boolean): Enable extended thinking for supported models
- `is_plan_mode` (boolean): Enable TodoList middleware for task tracking

**Response:** Server-Sent Events (SSE) stream

```
event: values
data: {"messages": [...], "title": "..."}

event: messages
data: {"content": "Hello! I'd be happy to help.", "role": "assistant"}

event: end
data: {}
```
```

**File:** backend/docs/API.md (L137-154)
```markdown
#### Get Run History

```http
GET /api/langgraph/threads/{thread_id}/runs
```

**Response:**
```json
{
  "runs": [
    {
      "run_id": "run123",
      "status": "success",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```
```

**File:** backend/docs/API.md (L156-166)
```markdown
#### Stream Run

Stream responses in real-time.

```http
POST /api/langgraph/threads/{thread_id}/runs/stream
Content-Type: application/json
```

Same request body as Create Run. Returns SSE stream.

```

**File:** backend/docs/API.md (L570-576)
```markdown
## WebSocket Support

The LangGraph server supports WebSocket connections for real-time streaming. Connect to:

```
ws://localhost:2026/api/langgraph/threads/{thread_id}/runs/stream
```
```

**File:** frontend/public/demo/threads/f4125791-0128-402a-8ca9-50e0947557e4/thread.json (L1-200)
```json
{
  "values": {
    "messages": [
      {
        "content": [
          {
            "type": "text",
            "text": "Create a liquid glass-style weather forecast. Below, you can add buttons to simulate sunny, rainy, and snowy weather. When you hover the mouse over it, the forecast will transform in 3D as the mouse moves."
          }
        ],
        "additional_kwargs": {},
        "response_metadata": {},
        "type": "human",
        "name": null,
        "id": "6409a240-5eeb-4df5-8681-4ad80a1daf7e"
      },
      {
        "content": "<uploaded_files>\nNo files have been uploaded yet.\n</uploaded_files>",
        "additional_kwargs": {},
        "response_metadata": {},
        "type": "system",
        "name": null,
        "id": "7c8e6d52-4b45-4ced-9d5d-deac209deed3"
      },
      {
        "content": "",
        "additional_kwargs": {},
        "response_metadata": {
          "finish_reason": "tool_calls",
          "model_name": "kimi-k2.5",
          "system_fingerprint": "fpv0_30fe32e5",
          "model_provider": "openai"
        },
        "type": "ai",
        "name": null,
        "id": "lc_run--019c02cb-bcb2-7f00-b7aa-928e943183ab",
        "tool_calls": [
          {
            "name": "read_file",
            "args": {
              "description": "Load frontend design skill",
              "path": "/mnt/skills/public/frontend-design/SKILL.md"
            },
            "id": "read_file:0",
            "type": "tool_call"
          }
        ],
        "invalid_tool_calls": [],
        "usage_metadata": null
      },
      {
        "content": "---\nname: frontend-design\ndescription: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.\nlicense: Complete terms in LICENSE.txt\n---\n\nThis skill guides creation of distinctive, production-grade frontend interfaces that avoid generic \"AI slop\" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.\n\nThe user provides frontend requirements: a component, page, applica ... (truncated)
        "additional_kwargs": {},
        "response_metadata": {},
        "type": "tool",
        "name": "read_file",
        "id": "c427252c-6142-4c64-a870-e9b361e4c4cb",
        "tool_call_id": "read_file:0",
        "artifact": null,
        "status": "success"
      },
      {
        "content": "Now I'll create a stunning liquid glass-style weather forecast with 3D hover effects and weather simulation buttons. This will be a distinctive, production-grade interface.",
        "additional_kwargs": {},
        "response_metadata": {
          "finish_reason": "tool_calls",
          "model_name": "kimi-k2.5",
          "system_fingerprint": "fpv0_30fe32e5",
          "model_provider": "openai"
        },
        "type": "ai",
        "name": null,
        "id": "lc_run--019c02cb-cf7b-7a82-bf57-02dfeed90cdc",
        "tool_calls": [
          {
            "name": "write_file",
            "args": {
              "description": "Create liquid glass weather forecast HTML",
              "path": "/mnt/user-data/outputs/index.html",
              "content": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Liquid Glass Weather</title>\n    <link href=\"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Syncopate:wght@400;700&display=swap\" rel=\"stylesheet\">\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n        }\n\n        :root {\n            --glass-bg: rgba(255, 255, 255, 0.08);\n            --glass-border: rgba(255, 255, 255, 0.18);\n            --glass-highlight: rgba(255, 255, 255, 0.25);\n            --glass-shadow: rgba(0, 0, 0, 0.3);\n            --text-primary: rgba(255, 255, 255, 0.95);\n  ... (truncated)
            },
            "id": "write_file:1",
            "type": "tool_call"
          }
        ],
        "invalid_tool_calls": [],
        "usage_metadata": null
      },
      {
        "content": "OK",
        "additional_kwargs": {},
        "response_metadata": {},
        "type": "tool",
        "name": "write_file",
        "id": "b2d1b182-cd90-42f5-b9db-a52f7c621584",
        "tool_call_id": "write_file:1",
        "artifact": null,
        "status": "success"
      },
      {
        "content": "",
        "additional_kwargs": {},
        "response_metadata": {
          "finish_reason": "tool_calls",
          "model_name": "kimi-k2.5",
          "system_fingerprint": "fpv0_30fe32e5",
          "model_provider": "openai"
        },
        "type": "ai",
        "name": null,
        "id": "lc_run--019c02ce-0d6b-7662-b671-6edfc5d7322c",
        "tool_calls": [
          {
            "name": "present_files",
            "args": {
              "filepaths": ["/mnt/user-data/outputs/index.html"]
            },
            "id": "present_files:2",
            "type": "tool_call"
          }
        ],
        "invalid_tool_calls": [],
        "usage_metadata": null
      },
      {
        "content": "Successfully presented files",
        "additional_kwargs": {},
        "response_metadata": {},
        "type": "tool",
        "name": "present_files",
        "id": "63e6f7ef-71c0-4fec-9cca-619d502bc090",
        "tool_call_id": "present_files:2",
        "artifact": null,
        "status": "success"
      },
      {
        "content": "I've created a stunning **liquid glass-style weather forecast** with full 3D interaction. Here's what makes it special:\n\n## Features\n\n**🪟 Liquid Glass Design**\n- Multi-layered glassmorphism with backdrop blur, subtle borders, and inner glows\n- Animated liquid shine effect that sweeps across the card\n- Dynamic shadows that respond to the 3D tilt\n\n**🎭 3D Hover Transformation**\n- Move your mouse over the weather card and watch it tilt in 3D space\n- Shadows dynamically shift based on tilt direction\n- Smooth, physics-based animations using CSS transforms\n\n**☀️🌧️❄️ Weather Simulation**\n- **Sunny**: Golden sun with rotating rays, warm glow effects\n- **Rainy**: Animated cloud with falling rain drops across the entire screen\n- **Snowy**: Soft cloud with gently f ... (truncated)
        "additional_kwargs": {},
        "response_metadata": {
          "finish_reason": "stop",
          "model_name": "kimi-k2.5",
          "system_fingerprint": "fpv0_30fe32e5",
          "model_provider": "openai"
        },
        "type": "ai",
        "name": null,
        "id": "lc_run--019c02ce-1464-7013-8a5d-19c2649e71d4",
        "tool_calls": [],
        "invalid_tool_calls": [],
        "usage_metadata": null
      }
    ],
    "thread_data": {
      "workspace_path": "/Users/henry/Desktop/deer-flow/backend/.deer-flow/threads/f4125791-0128-402a-8ca9-50e0947557e4/user-data/workspace",
      "uploads_path": "/Users/henry/Desktop/deer-flow/backend/.deer-flow/threads/f4125791-0128-402a-8ca9-50e0947557e4/user-data/uploads",
      "outputs_path": "/Users/henry/Desktop/deer-flow/backend/.deer-flow/threads/f4125791-0128-402a-8ca9-50e0947557e4/user-data/outputs"
    },
    "uploaded_files": [],
    "title": "Interactive 3D Weather Forecast Interface",
    "artifacts": ["/mnt/user-data/outputs/index.html"]
  },
  "next": [],
  "tasks": [],
  "metadata": {
    "model_name": "kimi-k2.5",
    "thinking_enabled": true,
    "is_plan_mode": true,
    "graph_id": "lead_agent",
    "assistant_id": "bee7d354-5df5-5f26-a978-10ea053f620d",
    "user_id": "",
    "created_by": "system",
    "thread_id": "f4125791-0128-402a-8ca9-50e0947557e4",
    "run_id": "019c02cb-b9ec-7ee1-8f16-1c0f7d3be447",
    "run_attempt": 1,
    "langgraph_version": "1.0.6",
    "langgraph_api_version": "0.6.38",
    "langgraph_plan": "developer",
    "langgraph_host": "self-hosted",
    "langgraph_api_url": "http://127.0.0.1:2024",
    "source": "loop",
    "step": 15,
    "parents": {},
    "langgraph_auth_user_id": "",
    "langgraph_request_id": "da3a64c8-c7b2-4692-a48e-44e7583db86e"
  },
  "created_at": "2026-01-28T04:13:14.394777+00:00",
  "checkpoint": {
    "checkpoint_id": "1f0fbffa-a7ba-674e-800f-42a5653bc5dc",
    "thread_id": "f4125791-0128-402a-8ca9-50e0947557e4",
    "checkpoint_ns": ""
  },
  "parent_checkpoint": {
    "checkpoint_id": "1f0fbffa-9f3c-6e8c-800e-411520ded234",
    "thread_id": "f4125791-0128-402a-8ca9-50e0947557e4",
    "checkpoint_ns": ""
  },
  "interrupts": [],
  "checkpoint_id": "1f0fbffa-a7ba-674e-800f-42a5653bc5dc",
  "parent_checkpoint_id": "1f0fbffa-9f3c-6e8c-800e-411520ded234"
}
```

**File:** backend/packages/harness/deerflow/agents/thread_state.py (L6-55)
```python
class SandboxState(TypedDict):
    sandbox_id: NotRequired[str | None]


class ThreadDataState(TypedDict):
    workspace_path: NotRequired[str | None]
    uploads_path: NotRequired[str | None]
    outputs_path: NotRequired[str | None]


class ViewedImageData(TypedDict):
    base64: str
    mime_type: str


def merge_artifacts(existing: list[str] | None, new: list[str] | None) -> list[str]:
    """Reducer for artifacts list - merges and deduplicates artifacts."""
    if existing is None:
        return new or []
    if new is None:
        return existing
    # Use dict.fromkeys to deduplicate while preserving order
    return list(dict.fromkeys(existing + new))


def merge_viewed_images(existing: dict[str, ViewedImageData] | None, new: dict[str, ViewedImageData] | None) -> dict[str, ViewedImageData]:
    """Reducer for viewed_images dict - merges image dictionaries.

    Special case: If new is an empty dict {}, it clears the existing images.
    This allows middlewares to clear the viewed_images state after processing.
    """
    if existing is None:
        return new or {}
    if new is None:
        return existing
    # Special case: empty dict means clear all viewed images
    if len(new) == 0:
        return {}
    # Merge dictionaries, new values override existing ones for same keys
    return {**existing, **new}


class ThreadState(AgentState):
    sandbox: NotRequired[SandboxState | None]
    thread_data: NotRequired[ThreadDataState | None]
    title: NotRequired[str | None]
    artifacts: Annotated[list[str], merge_artifacts]
    todos: NotRequired[list | None]
    uploaded_files: NotRequired[list[dict] | None]
    viewed_images: Annotated[dict[str, ViewedImageData], merge_viewed_images]  # image_path -> {base64, mime_type}
```

**File:** backend/docs/ARCHITECTURE.md (L91-94)
```markdown
- `artifacts.py` - `/api/threads/{id}/artifacts` - Artifact serving
- `suggestions.py` - `/api/threads/{id}/suggestions` - Follow-up suggestion generation

The web conversation delete flow is now split across both backend surfaces: LangGraph handles `DELETE /api/langgraph/threads/{thread_id}` for thread state, then the Gateway `threads.py` router removes DeerFlow-managed filesystem data via `Paths.delete_thread_dir()`.
```

**File:** frontend/src/core/threads/types.ts (L1-24)
```typescript
import type { Message, Thread } from "@langchain/langgraph-sdk";

import type { Todo } from "../todos";

export interface AgentThreadState extends Record<string, unknown> {
  title: string;
  messages: Message[];
  artifacts: string[];
  todos?: Todo[];
}

export interface AgentThreadContext extends Record<string, unknown> {
  thread_id: string;
  model_name: string | undefined;
  thinking_enabled: boolean;
  is_plan_mode: boolean;
  subagent_enabled: boolean;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  agent_name?: string;
}

export interface AgentThread extends Thread<AgentThreadState> {
  context?: AgentThreadContext;
}
```
