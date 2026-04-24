以下是 Gateway API 的完整接口说明，基于源码逐一整理。

---

## Gateway API 完整接口说明

Base URL: `/api`（通过 Nginx 端口 2026 代理到 Gateway 端口 8001） [1](#4-0) 

---

## 一、Models（模型） [2](#4-1) 

### `GET /api/models` — 列出所有模型

**Response: `ModelsListResponse`**
```json
{
  "models": [
    {
      "name": "gpt-4",
      "model": "gpt-4",
      "display_name": "GPT-4",
      "description": "OpenAI GPT-4 model",
      "supports_thinking": false,
      "supports_reasoning_effort": false
    }
  ],
  "token_usage": {
    "enabled": true
  }
}
```

### `GET /api/models/{model_name}` — 获取单个模型详情

**Response: `ModelResponse`**（同上 `models[]` 中的单个对象）

---

## 二、MCP 配置 [3](#4-2) 

### `GET /api/mcp/config` — 获取 MCP 配置

**Response: `McpConfigResponse`**
```json
{
  "mcp_servers": {
    "github": {
      "enabled": true,
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {"GITHUB_TOKEN": "ghp_xxx"},
      "url": null,
      "headers": {},
      "oauth": null,
      "description": "GitHub MCP server"
    }
  }
}
```

`oauth` 字段（`McpOAuthConfigResponse`）结构：
```json
{
  "enabled": true,
  "token_url": "https://...",
  "grant_type": "client_credentials",
  "client_id": "...",
  "client_secret": "...",
  "refresh_token": null,
  "scope": null,
  "audience": null,
  "token_field": "access_token",
  "token_type_field": "token_type",
  "expires_in_field": "expires_in",
  "default_token_type": "Bearer",
  "refresh_skew_seconds": 60,
  "extra_token_params": {}
}
```

### `PUT /api/mcp/config` — 更新 MCP 配置

**Request Body:** 同 `McpConfigResponse` 结构（`mcp_servers` 字段）
**Response:** 更新后的 `McpConfigResponse`（同上）

---

## 三、Skills（技能） [4](#4-3) 

### `GET /api/skills` — 列出所有技能

**Response: `SkillsListResponse`**
```json
{
  "skills": [
    {
      "name": "pdf-processing",
      "description": "Handle PDF documents",
      "license": "MIT",
      "category": "public",
      "enabled": true
    }
  ]
}
```

### `GET /api/skills/{skill_name}` — 获取技能详情

**Response: `SkillResponse`**（同上 `skills[]` 中的单个对象）

### `PUT /api/skills/{skill_name}` — 更新技能启用状态

**Request Body:**
```json
{ "enabled": true }
```
**Response: `SkillResponse`**（更新后的技能信息）

### `POST /api/skills/install` — 安装技能包

**Request Body:**
```json
{
  "thread_id": "abc123",
  "path": "mnt/user-data/outputs/my-skill.skill"
}
```
**Response: `SkillInstallResponse`**
```json
{
  "success": true,
  "skill_name": "my-skill",
  "message": "Skill installed successfully"
}
```

### `GET /api/skills/custom` — 列出自定义技能

**Response: `SkillsListResponse`**（仅 `category="custom"` 的技能）

### `GET /api/skills/custom/{skill_name}` — 获取自定义技能内容

**Response: `CustomSkillContentResponse`**（继承 `SkillResponse`，额外含 `content` 字段）
```json
{
  "name": "my-skill",
  "description": "...",
  "license": null,
  "category": "custom",
  "enabled": true,
  "content": "---\nname: my-skill\n..."
}
```

### `PUT /api/skills/custom/{skill_name}` — 编辑自定义技能

**Request Body:**
```json
{ "content": "---\nname: my-skill\n..." }
```
**Response: `CustomSkillContentResponse`**

### `DELETE /api/skills/custom/{skill_name}` — 删除自定义技能

**Response:**
```json
{ "success": true }
```

### `GET /api/skills/custom/{skill_name}/history` — 获取技能编辑历史

**Response: `CustomSkillHistoryResponse`**
```json
{
  "history": [
    {
      "action": "human_edit",
      "author": "human",
      "thread_id": null,
      "file_path": "SKILL.md",
      "prev_content": "...",
      "new_content": "...",
      "scanner": {"decision": "allow", "reason": "..."}
    }
  ]
}
```

### `POST /api/skills/custom/{skill_name}/rollback` — 回滚技能版本

**Request Body:**
```json
{ "history_index": -1 }
```
**Response: `CustomSkillContentResponse`** [5](#4-4) 

---

## 四、Memory（记忆） [6](#4-5) 

### `GET /api/memory` — 获取记忆数据

**Response: `MemoryResponse`**
```json
{
  "version": "1.0",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "user": {
    "workContext": {"summary": "...", "updatedAt": "..."},
    "personalContext": {"summary": "...", "updatedAt": "..."},
    "topOfMind": {"summary": "...", "updatedAt": "..."}
  },
  "history": {
    "recentMonths": {"summary": "...", "updatedAt": "..."},
    "earlierContext": {"summary": "", "updatedAt": ""},
    "longTermBackground": {"summary": "", "updatedAt": ""}
  },
  "facts": [
    {
      "id": "fact_abc123",
      "content": "User prefers TypeScript",
      "category": "preference",
      "confidence": 0.9,
      "createdAt": "2024-01-15T10:30:00Z",
      "source": "thread_xyz",
      "sourceError": null
    }
  ]
}
```

### `POST /api/memory/reload` — 强制重新加载记忆

**Response: `MemoryResponse`**（重新加载后的数据）

### `DELETE /api/memory` — 清空所有记忆数据

**Response: `MemoryResponse`**（清空后的空结构）

### `GET /api/memory/config` — 获取记忆配置

**Response: `MemoryConfigResponse`**
```json
{
  "enabled": true,
  "storage_path": ".deer-flow/memory.json",
  "debounce_seconds": 30,
  "max_facts": 100,
  "fact_confidence_threshold": 0.7,
  "injection_enabled": true,
  "max_injection_tokens": 2000
}
```

### `GET /api/memory/status` — 获取记忆状态（配置+数据）

**Response: `MemoryStatusResponse`**
```json
{
  "config": { /* MemoryConfigResponse */ },
  "data": { /* MemoryResponse */ }
}
```

### `GET /api/memory/export` — 导出记忆数据

**Response: `MemoryResponse`**

### `POST /api/memory/import` — 导入记忆数据

**Request Body:** `MemoryResponse` 结构（完整记忆 JSON）
**Response: `MemoryResponse`**（导入后的数据）

### `POST /api/memory/facts` — 手动创建记忆事实

**Request Body:**
```json
{
  "content": "User prefers dark mode",
  "category": "preference",
  "confidence": 0.8
}
```
**Response: `MemoryResponse`**（更新后的完整记忆）

### `PATCH /api/memory/facts/{fact_id}` — 部分更新记忆事实

**Request Body:**（所有字段可选）
```json
{
  "content": "Updated content",
  "category": "context",
  "confidence": 0.9
}
```
**Response: `MemoryResponse`**

### `DELETE /api/memory/facts/{fact_id}` — 删除记忆事实

**Response: `MemoryResponse`**（删除后的完整记忆） [7](#4-6) 

---

## 五、Threads（线程管理） [8](#4-7) 

### `POST /api/threads` — 创建线程

**Request Body:**
```json
{
  "thread_id": "optional-custom-id",
  "metadata": {}
}
```
**Response: `ThreadResponse`**
```json
{
  "thread_id": "abc123",
  "status": "idle",
  "created_at": "1705997600.0",
  "updated_at": "1705997600.0",
  "metadata": {},
  "values": {},
  "interrupts": {}
}
```

`status` 枚举值：`idle` / `busy` / `interrupted` / `error`

### `POST /api/threads/search` — 搜索线程列表

**Request Body:**
```json
{
  "metadata": {},
  "limit": 100,
  "offset": 0,
  "status": null
}
```
**Response: `list[ThreadResponse]`**（按 `updated_at` 降序排列）

### `GET /api/threads/{thread_id}` — 获取线程信息

**Response: `ThreadResponse`**（含 `values` 中的 channel 快照，如 `title`）

### `PATCH /api/threads/{thread_id}` — 更新线程元数据

**Request Body:**
```json
{ "metadata": {"agent_name": "my-agent"} }
```
**Response: `ThreadResponse`**

### `DELETE /api/threads/{thread_id}` — 删除线程本地数据

**Response: `ThreadDeleteResponse`**
```json
{
  "success": true,
  "message": "Deleted local thread data for abc123"
}
```

### `GET /api/threads/{thread_id}/state` — 获取线程状态快照

**Response: `ThreadStateResponse`**
```json
{
  "values": {
    "messages": [...],
    "title": "Conversation Title",
    "artifacts": ["/mnt/user-data/outputs/index.html"]
  },
  "next": [],
  "metadata": {"step": 15, "source": "loop"},
  "checkpoint": {"id": "...", "ts": "..."},
  "checkpoint_id": "...",
  "parent_checkpoint_id": "...",
  "created_at": "...",
  "tasks": [{"id": "...", "name": "..."}]
}
```

### `POST /api/threads/{thread_id}/state` — 更新线程状态（Human-in-the-loop）

**Request Body:**
```json
{
  "values": {"title": "New Title"},
  "checkpoint_id": null,
  "checkpoint": null,
  "as_node": null
}
```
**Response: `ThreadStateResponse`**

### `POST /api/threads/{thread_id}/history` — 获取 Checkpoint 历史

**Request Body:**
```json
{ "limit": 10, "before": null }
```
**Response: `list[HistoryEntry]`**
```json
[
  {
    "checkpoint_id": "...",
    "parent_checkpoint_id": "...",
    "metadata": {},
    "values": {},
    "created_at": "...",
    "next": []
  }
]
``` [9](#4-8) 

---

## 六、Thread Runs（线程内运行） [10](#4-9) 

### `POST /api/threads/{thread_id}/runs` — 创建后台运行（立即返回）

**Request Body: `RunCreateRequest`**
```json
{
  "assistant_id": "lead_agent",
  "input": {"messages": [{"role": "user", "content": "Hello"}]},
  "config": {"configurable": {"model_name": "gpt-4", "thinking_enabled": false}},
  "context": {"is_plan_mode": false, "subagent_enabled": false},
  "stream_mode": ["values", "messages-tuple", "custom"],
  "multitask_strategy": "reject",
  "on_disconnect": "cancel",
  "on_completion": "keep"
}
```
**Response: `RunResponse`**
```json
{
  "run_id": "run-uuid",
  "thread_id": "abc123",
  "assistant_id": "lead_agent",
  "status": "pending",
  "metadata": {},
  "kwargs": {},
  "multitask_strategy": "reject",
  "created_at": "...",
  "updated_at": "..."
}
```

### `POST /api/threads/{thread_id}/runs/stream` — 创建运行并 SSE 流式返回

**Request Body:** 同上 `RunCreateRequest`
**Response:** SSE 事件流（`text/event-stream`），响应头含 `Content-Location: /api/threads/{thread_id}/runs/{run_id}`

### `POST /api/threads/{thread_id}/runs/wait` — 创建运行并阻塞等待完成

**Request Body:** 同上 `RunCreateRequest`
**Response:** 最终 channel values（`dict`，即 `ThreadState` 的序列化结果）

### `GET /api/threads/{thread_id}/runs` — 列出线程所有运行

**Response: `list[RunResponse]`**

### `GET /api/threads/{thread_id}/runs/{run_id}` — 获取单个运行详情

**Response: `RunResponse`**

### `POST /api/threads/{thread_id}/runs/{run_id}/cancel` — 取消运行

**Query Params:**
- `wait` (bool, default `false`): 是否阻塞等待取消完成
- `action` (`interrupt` | `rollback`, default `interrupt`): 取消方式

**Response:** `202 Accepted` 或 `204 No Content`（`wait=true` 时）

### `GET /api/threads/{thread_id}/runs/{run_id}/join` — 加入已有运行的 SSE 流

**Response:** SSE 事件流

### `GET|POST /api/threads/{thread_id}/runs/{run_id}/stream` — 加入或取消后流式返回

**Query Params:**
- `action` (`interrupt` | `rollback`): 取消动作（可选）
- `wait` (int, default `0`): 是否等待取消

**Response:** SSE 事件流 或 `204 No Content` [11](#4-10) 

---

## 七、Stateless Runs（无状态运行） [12](#4-11) 

### `POST /api/runs/stream` — 无状态流式运行

自动创建临时线程（或复用 `config.configurable.thread_id`）。

**Request Body:** 同 `RunCreateRequest`
**Response:** SSE 事件流

### `POST /api/runs/wait` — 无状态阻塞运行

**Request Body:** 同 `RunCreateRequest`
**Response:** 最终 channel values（`dict`）

---

## 八、Uploads（文件上传） [13](#4-12) 

### `POST /api/threads/{thread_id}/uploads` — 上传文件

**Request Body:** `multipart/form-data`，字段 `files`（支持多文件）

**Response: `UploadResponse`**
```json
{
  "success": true,
  "files": [
    {
      "filename": "document.pdf",
      "size": "1234567",
      "path": ".deer-flow/threads/abc123/user-data/uploads/document.pdf",
      "virtual_path": "/mnt/user-data/uploads/document.pdf",
      "artifact_url": "/api/threads/abc123/artifacts/mnt/user-data/uploads/document.pdf",
      "markdown_file": "document.md",
      "markdown_path": "...",
      "markdown_virtual_path": "/mnt/user-data/uploads/document.md",
      "markdown_artifact_url": "..."
    }
  ],
  "message": "Successfully uploaded 1 file(s)"
}
```

支持自动转换为 Markdown 的格式：`.pdf` / `.ppt` / `.pptx` / `.xls` / `.xlsx` / `.doc` / `.docx`

### `GET /api/threads/{thread_id}/uploads/list` — 列出已上传文件

**Response:**
```json
{
  "files": [
    {
      "filename": "document.pdf",
      "size": 1234567,
      "path": "...",
      "virtual_path": "/mnt/user-data/uploads/document.pdf",
      "artifact_url": "...",
      "extension": ".pdf",
      "modified": 1705997600.0
    }
  ],
  "count": 1
}
```

### `DELETE /api/threads/{thread_id}/uploads/{filename}` — 删除上传文件

**Response:**
```json
{ "success": true, "message": "Deleted document.pdf" }
```

---

## 九、Artifacts（工件文件） [14](#4-13) 

### `GET /api/threads/{thread_id}/artifacts/{path:path}` — 获取工件文件

**Query Params:**
- `download` (bool, default `false`): 强制下载

**Response:** 文件内容，Content-Type 自动检测

| 文件类型 | 行为 |
|---------|------|
| HTML / XHTML / SVG | 强制 `attachment` 下载（防 XSS） |
| 文本文件 | `PlainTextResponse` 内联显示 |
| 二进制文件 | `inline` 显示 |
| `.skill` 内部文件 | 从 ZIP 中提取后返回 |

---

## 十、Suggestions（建议问题） [15](#4-14) 

### `POST /api/threads/{thread_id}/suggestions` — 生成后续问题

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "n": 3,
  "model_name": null
}
```
**Response: `SuggestionsResponse`**
```json
{
  "suggestions": [
    "What are the next steps?",
    "Can you explain more about X?",
    "How does Y work?"
  ]
}
```

---

## 十一、Agents（自定义代理）

> 需要在配置中启用 `agents_api.enabled=true`，否则返回 `403`。 [16](#4-15) 

### `GET /api/agents` — 列出所有自定义代理

**Response: `AgentsListResponse`**
```json
{
  "agents": [
    {
      "name": "my-agent",
      "description": "A custom agent",
      "model": "gpt-4",
      "tool_groups": ["search", "code"],
      "soul": "# SOUL.md content..."
    }
  ]
}
```

### `GET /api/agents/check?name={name}` — 检查代理名称是否可用

**Response:**
```json
{ "available": true, "name": "my-agent" }
```

### `GET /api/agents/{name}` — 获取代理详情

**Response: `AgentResponse`**（含 `soul` 字段）

### `POST /api/agents` — 创建自定义代理

**Request Body:**
```json
{
  "name": "my-agent",
  "description": "A custom agent",
  "model": "gpt-4",
  "tool_groups": ["search"],
  "soul": "# SOUL.md content..."
}
```
**Response: `AgentResponse`**（HTTP 201）

### `PUT /api/agents/{name}` — 更新代理

**Request Body:**（所有字段可选）
```json
{
  "description": "Updated description",
  "model": null,
  "tool_groups": null,
  "soul": "Updated SOUL.md..."
}
```
**Response: `AgentResponse`**

### `DELETE /api/agents/{name}` — 删除代理

**Response:** HTTP 204 No Content

### `GET /api/user-profile` — 获取全局用户档案

**Response: `UserProfileResponse`**
```json
{ "content": "# USER.md content..." }
```

### `PUT /api/user-profile` — 更新全局用户档案

**Request Body:**
```json
{ "content": "# USER.md content..." }
```
**Response: `UserProfileResponse`** [17](#4-16) 

---

## 十二、Assistants Compat（助手兼容层）

兼容 LangGraph Platform SDK 的 `assistants` API，供 `useStream` React hook 初始化使用。 [18](#4-17) 

### `POST /api/assistants/search` — 搜索助手

**Request Body:**
```json
{ "graph_id": null, "name": null, "metadata": null, "limit": 10, "offset": 0 }
```
**Response: `list[AssistantResponse]`**
```json
[
  {
    "assistant_id": "lead_agent",
    "graph_id": "lead_agent",
    "name": "lead_agent",
    "config": {},
    "metadata": {"created_by": "system"},
    "description": "DeerFlow lead agent",
    "created_at": "...",
    "updated_at": "...",
    "version": 1
  }
]
```

### `GET /api/assistants/{assistant_id}` — 获取助手详情

**Response: `AssistantResponse`**

### `GET /api/assistants/{assistant_id}/graph` — 获取助手图结构（Stub）

**Response:**
```json
{ "graph_id": "lead_agent", "nodes": [], "edges": [] }
```

### `GET /api/assistants/{assistant_id}/schemas` — 获取助手 Schema（Stub）

**Response:**
```json
{ "graph_id": "lead_agent", "input_schema": {}, "output_schema": {}, "state_schema": {}, "config_schema": {} }
```

---

## 十三、Channels（IM 频道） [19](#4-18) 

### `GET /api/channels/` — 获取所有 IM 频道状态

**Response: `ChannelStatusResponse`**
```json
{
  "service_running": true,
  "channels": {
    "telegram": {"status": "running", "...": "..."}
  }
}
```

### `POST /api/channels/{name}/restart` — 重启指定 IM 频道

**Response: `ChannelRestartResponse`**
```json
{
  "success": true,
  "message": "Channel telegram restarted successfully"
}
```

---

## 十四、健康检查

```http
GET /health
```
**Response:** `200 OK`（FastAPI 应用健康状态） [20](#4-19) 

---

## 接口总览表

| 分组 | 路径 | 方法 | 说明 |
|------|------|------|------|
| Models | `/api/models` | GET | 列出所有模型 |
| Models | `/api/models/{name}` | GET | 获取模型详情 |
| MCP | `/api/mcp/config` | GET/PUT | 获取/更新 MCP 配置 |
| Skills | `/api/skills` | GET | 列出所有技能 |
| Skills | `/api/skills/{name}` | GET/PUT | 获取/更新技能 |
| Skills | `/api/skills/install` | POST | 安装技能包 |
| Skills | `/api/skills/custom` | GET | 列出自定义技能 |
| Skills | `/api/skills/custom/{name}` | GET/PUT/DELETE | 自定义技能 CRUD |
| Skills | `/api/skills/custom/{name}/history` | GET | 技能编辑历史 |
| Skills | `/api/skills/custom/{name}/rollback` | POST | 回滚技能版本 |
| Memory | `/api/memory` | GET/DELETE | 获取/清空记忆 |
| Memory | `/api/memory/reload` | POST | 重新加载记忆 |
| Memory | `/api/memory/config` | GET | 获取记忆配置 |
| Memory | `/api/memory/status` | GET | 获取记忆状态 |
| Memory | `/api/memory/export` | GET | 导出记忆 |
| Memory | `/api/memory/import` | POST | 导入记忆 |
| Memory | `/api/memory/facts` | POST | 创建记忆事实 |
| Memory | `/api/memory/facts/{id}` | PATCH/DELETE | 更新/删除记忆事实 |
| Threads | `/api/threads` | POST | 创建线程 |
| Threads | `/api/threads/search` | POST | 搜索线程列表 |
| Threads | `/api/threads/{id}` | GET/PATCH/DELETE | 线程 CRUD |
| Threads | `/api/threads/{id}/state` | GET/POST | 获取/更新线程状态 |
| Threads | `/api/threads/{id}/history` | POST | 获取 Checkpoint 历史 |
| Runs | `/api/threads/{id}/runs` | POST/GET | 创建/列出运行 |
| Runs | `/api/threads/{id}/runs/stream` | POST | 流式运行 |
| Runs | `/api/threads/{id}/runs/wait` | POST |

### Citations

**File:** backend/docs/API.md (L169-172)
```markdown
## Gateway API

Base URL: `/api`

```

**File:** backend/app/gateway/routers/models.py (L6-30)
```python
router = APIRouter(prefix="/api", tags=["models"])


class ModelResponse(BaseModel):
    """Response model for model information."""

    name: str = Field(..., description="Unique identifier for the model")
    model: str = Field(..., description="Actual provider model identifier")
    display_name: str | None = Field(None, description="Human-readable name")
    description: str | None = Field(None, description="Model description")
    supports_thinking: bool = Field(default=False, description="Whether model supports thinking mode")
    supports_reasoning_effort: bool = Field(default=False, description="Whether model supports reasoning effort")


class TokenUsageResponse(BaseModel):
    """Token usage display configuration."""

    enabled: bool = Field(default=False, description="Whether token usage display is enabled")


class ModelsListResponse(BaseModel):
    """Response model for listing all models."""

    models: list[ModelResponse]
    token_usage: TokenUsageResponse
```

**File:** backend/app/gateway/routers/mcp.py (L34-64)
```python
class McpServerConfigResponse(BaseModel):
    """Response model for MCP server configuration."""

    enabled: bool = Field(default=True, description="Whether this MCP server is enabled")
    type: str = Field(default="stdio", description="Transport type: 'stdio', 'sse', or 'http'")
    command: str | None = Field(default=None, description="Command to execute to start the MCP server (for stdio type)")
    args: list[str] = Field(default_factory=list, description="Arguments to pass to the command (for stdio type)")
    env: dict[str, str] = Field(default_factory=dict, description="Environment variables for the MCP server")
    url: str | None = Field(default=None, description="URL of the MCP server (for sse or http type)")
    headers: dict[str, str] = Field(default_factory=dict, description="HTTP headers to send (for sse or http type)")
    oauth: McpOAuthConfigResponse | None = Field(default=None, description="OAuth configuration for MCP HTTP/SSE servers")
    description: str = Field(default="", description="Human-readable description of what this MCP server provides")


class McpConfigResponse(BaseModel):
    """Response model for MCP configuration."""

    mcp_servers: dict[str, McpServerConfigResponse] = Field(
        default_factory=dict,
        description="Map of MCP server name to configuration",
    )


class McpConfigUpdateRequest(BaseModel):
    """Request model for updating MCP configuration."""

    mcp_servers: dict[str, McpServerConfigResponse] = Field(
        ...,
        description="Map of MCP server name to configuration",
    )

```

**File:** backend/app/gateway/routers/skills.py (L34-85)
```python
class SkillResponse(BaseModel):
    """Response model for skill information."""

    name: str = Field(..., description="Name of the skill")
    description: str = Field(..., description="Description of what the skill does")
    license: str | None = Field(None, description="License information")
    category: str = Field(..., description="Category of the skill (public or custom)")
    enabled: bool = Field(default=True, description="Whether this skill is enabled")


class SkillsListResponse(BaseModel):
    """Response model for listing all skills."""

    skills: list[SkillResponse]


class SkillUpdateRequest(BaseModel):
    """Request model for updating a skill."""

    enabled: bool = Field(..., description="Whether to enable or disable the skill")


class SkillInstallRequest(BaseModel):
    """Request model for installing a skill from a .skill file."""

    thread_id: str = Field(..., description="The thread ID where the .skill file is located")
    path: str = Field(..., description="Virtual path to the .skill file (e.g., mnt/user-data/outputs/my-skill.skill)")


class SkillInstallResponse(BaseModel):
    """Response model for skill installation."""

    success: bool = Field(..., description="Whether the installation was successful")
    skill_name: str = Field(..., description="Name of the installed skill")
    message: str = Field(..., description="Installation result message")


class CustomSkillContentResponse(SkillResponse):
    content: str = Field(..., description="Raw SKILL.md content")


class CustomSkillUpdateRequest(BaseModel):
    content: str = Field(..., description="Replacement SKILL.md content")


class CustomSkillHistoryResponse(BaseModel):
    history: list[dict]


class SkillRollbackRequest(BaseModel):
    history_index: int = Field(default=-1, description="History entry index to restore from, defaulting to the latest change.")

```

**File:** backend/app/gateway/routers/skills.py (L247-290)
```python
@router.post("/skills/custom/{skill_name}/rollback", response_model=CustomSkillContentResponse, summary="Rollback Custom Skill")
async def rollback_custom_skill(skill_name: str, request: SkillRollbackRequest) -> CustomSkillContentResponse:
    try:
        if not custom_skill_exists(skill_name) and not get_skill_history_file(skill_name).exists():
            raise HTTPException(status_code=404, detail=f"Custom skill '{skill_name}' not found")
        history = read_history(skill_name)
        if not history:
            raise HTTPException(status_code=400, detail=f"Custom skill '{skill_name}' has no history")
        record = history[request.history_index]
        target_content = record.get("prev_content")
        if target_content is None:
            raise HTTPException(status_code=400, detail="Selected history entry has no previous content to roll back to")
        validate_skill_markdown_content(skill_name, target_content)
        scan = await scan_skill_content(target_content, executable=False, location=f"{skill_name}/SKILL.md")
        skill_file = get_custom_skill_file(skill_name)
        current_content = skill_file.read_text(encoding="utf-8") if skill_file.exists() else None
        history_entry = {
            "action": "rollback",
            "author": "human",
            "thread_id": None,
            "file_path": "SKILL.md",
            "prev_content": current_content,
            "new_content": target_content,
            "rollback_from_ts": record.get("ts"),
            "scanner": {"decision": scan.decision, "reason": scan.reason},
        }
        if scan.decision == "block":
            append_history(skill_name, history_entry)
            raise HTTPException(status_code=400, detail=f"Rollback blocked by security scanner: {scan.reason}")
        atomic_write(skill_file, target_content)
        append_history(skill_name, history_entry)
        await refresh_skills_system_prompt_cache_async()
        return await get_custom_skill(skill_name)
    except HTTPException:
        raise
    except IndexError:
        raise HTTPException(status_code=400, detail="history_index is out of range")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Failed to roll back custom skill %s: %s", skill_name, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to roll back custom skill: {str(e)}")
```

**File:** backend/app/gateway/routers/memory.py (L20-107)
```python
class ContextSection(BaseModel):
    """Model for context sections (user and history)."""

    summary: str = Field(default="", description="Summary content")
    updatedAt: str = Field(default="", description="Last update timestamp")


class UserContext(BaseModel):
    """Model for user context."""

    workContext: ContextSection = Field(default_factory=ContextSection)
    personalContext: ContextSection = Field(default_factory=ContextSection)
    topOfMind: ContextSection = Field(default_factory=ContextSection)


class HistoryContext(BaseModel):
    """Model for history context."""

    recentMonths: ContextSection = Field(default_factory=ContextSection)
    earlierContext: ContextSection = Field(default_factory=ContextSection)
    longTermBackground: ContextSection = Field(default_factory=ContextSection)


class Fact(BaseModel):
    """Model for a memory fact."""

    id: str = Field(..., description="Unique identifier for the fact")
    content: str = Field(..., description="Fact content")
    category: str = Field(default="context", description="Fact category")
    confidence: float = Field(default=0.5, description="Confidence score (0-1)")
    createdAt: str = Field(default="", description="Creation timestamp")
    source: str = Field(default="unknown", description="Source thread ID")
    sourceError: str | None = Field(default=None, description="Optional description of the prior mistake or wrong approach")


class MemoryResponse(BaseModel):
    """Response model for memory data."""

    version: str = Field(default="1.0", description="Memory schema version")
    lastUpdated: str = Field(default="", description="Last update timestamp")
    user: UserContext = Field(default_factory=UserContext)
    history: HistoryContext = Field(default_factory=HistoryContext)
    facts: list[Fact] = Field(default_factory=list)


def _map_memory_fact_value_error(exc: ValueError) -> HTTPException:
    """Convert updater validation errors into stable API responses."""
    if exc.args and exc.args[0] == "confidence":
        detail = "Invalid confidence value; must be between 0 and 1."
    else:
        detail = "Memory fact content cannot be empty."
    return HTTPException(status_code=400, detail=detail)


class FactCreateRequest(BaseModel):
    """Request model for creating a memory fact."""

    content: str = Field(..., min_length=1, description="Fact content")
    category: str = Field(default="context", description="Fact category")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="Confidence score (0-1)")


class FactPatchRequest(BaseModel):
    """PATCH request model that preserves existing values for omitted fields."""

    content: str | None = Field(default=None, min_length=1, description="Fact content")
    category: str | None = Field(default=None, description="Fact category")
    confidence: float | None = Field(default=None, ge=0.0, le=1.0, description="Confidence score (0-1)")


class MemoryConfigResponse(BaseModel):
    """Response model for memory configuration."""

    enabled: bool = Field(..., description="Whether memory is enabled")
    storage_path: str = Field(..., description="Path to memory storage file")
    debounce_seconds: int = Field(..., description="Debounce time for memory updates")
    max_facts: int = Field(..., description="Maximum number of facts to store")
    fact_confidence_threshold: float = Field(..., description="Minimum confidence threshold for facts")
    injection_enabled: bool = Field(..., description="Whether memory injection is enabled")
    max_injection_tokens: int = Field(..., description="Maximum tokens for memory injection")


class MemoryStatusResponse(BaseModel):
    """Response model for memory status."""

    config: MemoryConfigResponse
    data: MemoryResponse

```

**File:** backend/app/gateway/routers/memory.py (L191-286)
```python
@router.post(
    "/memory/facts",
    response_model=MemoryResponse,
    response_model_exclude_none=True,
    summary="Create Memory Fact",
    description="Create a single saved memory fact manually.",
)
async def create_memory_fact_endpoint(request: FactCreateRequest) -> MemoryResponse:
    """Create a single fact manually."""
    try:
        memory_data = create_memory_fact(
            content=request.content,
            category=request.category,
            confidence=request.confidence,
        )
    except ValueError as exc:
        raise _map_memory_fact_value_error(exc) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to create memory fact.") from exc

    return MemoryResponse(**memory_data)


@router.delete(
    "/memory/facts/{fact_id}",
    response_model=MemoryResponse,
    response_model_exclude_none=True,
    summary="Delete Memory Fact",
    description="Delete a single saved memory fact by its fact id.",
)
async def delete_memory_fact_endpoint(fact_id: str) -> MemoryResponse:
    """Delete a single fact from memory by fact id."""
    try:
        memory_data = delete_memory_fact(fact_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Memory fact '{fact_id}' not found.") from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to delete memory fact.") from exc

    return MemoryResponse(**memory_data)


@router.patch(
    "/memory/facts/{fact_id}",
    response_model=MemoryResponse,
    response_model_exclude_none=True,
    summary="Patch Memory Fact",
    description="Partially update a single saved memory fact by its fact id while preserving omitted fields.",
)
async def update_memory_fact_endpoint(fact_id: str, request: FactPatchRequest) -> MemoryResponse:
    """Partially update a single fact manually."""
    try:
        memory_data = update_memory_fact(
            fact_id=fact_id,
            content=request.content,
            category=request.category,
            confidence=request.confidence,
        )
    except ValueError as exc:
        raise _map_memory_fact_value_error(exc) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Memory fact '{fact_id}' not found.") from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to update memory fact.") from exc

    return MemoryResponse(**memory_data)


@router.get(
    "/memory/export",
    response_model=MemoryResponse,
    response_model_exclude_none=True,
    summary="Export Memory Data",
    description="Export the current global memory data as JSON for backup or transfer.",
)
async def export_memory() -> MemoryResponse:
    """Export the current memory data."""
    memory_data = get_memory_data()
    return MemoryResponse(**memory_data)


@router.post(
    "/memory/import",
    response_model=MemoryResponse,
    response_model_exclude_none=True,
    summary="Import Memory Data",
    description="Import and overwrite the current global memory data from a JSON payload.",
)
async def import_memory(request: MemoryResponse) -> MemoryResponse:
    """Import and persist memory data."""
    try:
        memory_data = import_memory_data(request.model_dump())
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to import memory data.") from exc

    return MemoryResponse(**memory_data)
```

**File:** backend/app/gateway/routers/threads.py (L43-122)
```python
class ThreadDeleteResponse(BaseModel):
    """Response model for thread cleanup."""

    success: bool
    message: str


class ThreadResponse(BaseModel):
    """Response model for a single thread."""

    thread_id: str = Field(description="Unique thread identifier")
    status: str = Field(default="idle", description="Thread status: idle, busy, interrupted, error")
    created_at: str = Field(default="", description="ISO timestamp")
    updated_at: str = Field(default="", description="ISO timestamp")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Thread metadata")
    values: dict[str, Any] = Field(default_factory=dict, description="Current state channel values")
    interrupts: dict[str, Any] = Field(default_factory=dict, description="Pending interrupts")


class ThreadCreateRequest(BaseModel):
    """Request body for creating a thread."""

    thread_id: str | None = Field(default=None, description="Optional thread ID (auto-generated if omitted)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Initial metadata")


class ThreadSearchRequest(BaseModel):
    """Request body for searching threads."""

    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata filter (exact match)")
    limit: int = Field(default=100, ge=1, le=1000, description="Maximum results")
    offset: int = Field(default=0, ge=0, description="Pagination offset")
    status: str | None = Field(default=None, description="Filter by thread status")


class ThreadStateResponse(BaseModel):
    """Response model for thread state."""

    values: dict[str, Any] = Field(default_factory=dict, description="Current channel values")
    next: list[str] = Field(default_factory=list, description="Next tasks to execute")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Checkpoint metadata")
    checkpoint: dict[str, Any] = Field(default_factory=dict, description="Checkpoint info")
    checkpoint_id: str | None = Field(default=None, description="Current checkpoint ID")
    parent_checkpoint_id: str | None = Field(default=None, description="Parent checkpoint ID")
    created_at: str | None = Field(default=None, description="Checkpoint timestamp")
    tasks: list[dict[str, Any]] = Field(default_factory=list, description="Interrupted task details")


class ThreadPatchRequest(BaseModel):
    """Request body for patching thread metadata."""

    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata to merge")


class ThreadStateUpdateRequest(BaseModel):
    """Request body for updating thread state (human-in-the-loop resume)."""

    values: dict[str, Any] | None = Field(default=None, description="Channel values to merge")
    checkpoint_id: str | None = Field(default=None, description="Checkpoint to branch from")
    checkpoint: dict[str, Any] | None = Field(default=None, description="Full checkpoint object")
    as_node: str | None = Field(default=None, description="Node identity for the update")


class HistoryEntry(BaseModel):
    """Single checkpoint history entry."""

    checkpoint_id: str
    parent_checkpoint_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    values: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    next: list[str] = Field(default_factory=list)


class ThreadHistoryRequest(BaseModel):
    """Request body for checkpoint history."""

    limit: int = Field(default=10, ge=1, le=100, description="Maximum entries")
    before: str | None = Field(default=None, description="Cursor for pagination")

```

**File:** backend/app/gateway/routers/threads.py (L640-682)
```python
@router.post("/{thread_id}/history", response_model=list[HistoryEntry])
async def get_thread_history(thread_id: str, body: ThreadHistoryRequest, request: Request) -> list[HistoryEntry]:
    """Get checkpoint history for a thread."""
    checkpointer = get_checkpointer(request)

    config: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
    if body.before:
        config["configurable"]["checkpoint_id"] = body.before

    entries: list[HistoryEntry] = []
    try:
        async for checkpoint_tuple in checkpointer.alist(config, limit=body.limit):
            ckpt_config = getattr(checkpoint_tuple, "config", {})
            parent_config = getattr(checkpoint_tuple, "parent_config", None)
            metadata = getattr(checkpoint_tuple, "metadata", {}) or {}
            checkpoint = getattr(checkpoint_tuple, "checkpoint", {}) or {}

            checkpoint_id = ckpt_config.get("configurable", {}).get("checkpoint_id", "")
            parent_id = None
            if parent_config:
                parent_id = parent_config.get("configurable", {}).get("checkpoint_id")

            channel_values = checkpoint.get("channel_values", {})

            # Derive next tasks
            tasks_raw = getattr(checkpoint_tuple, "tasks", []) or []
            next_tasks = [t.name for t in tasks_raw if hasattr(t, "name")]

            entries.append(
                HistoryEntry(
                    checkpoint_id=checkpoint_id,
                    parent_checkpoint_id=parent_id,
                    metadata=metadata,
                    values=serialize_channel_values(channel_values),
                    created_at=str(metadata.get("created_at", "")),
                    next=next_tasks,
                )
            )
    except Exception:
        logger.exception("Failed to get history for thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Failed to get thread history")

    return entries
```

**File:** backend/app/gateway/routers/thread_runs.py (L35-68)
```python
class RunCreateRequest(BaseModel):
    assistant_id: str | None = Field(default=None, description="Agent / assistant to use")
    input: dict[str, Any] | None = Field(default=None, description="Graph input (e.g. {messages: [...]})")
    command: dict[str, Any] | None = Field(default=None, description="LangGraph Command")
    metadata: dict[str, Any] | None = Field(default=None, description="Run metadata")
    config: dict[str, Any] | None = Field(default=None, description="RunnableConfig overrides")
    context: dict[str, Any] | None = Field(default=None, description="DeerFlow context overrides (model_name, thinking_enabled, etc.)")
    webhook: str | None = Field(default=None, description="Completion callback URL")
    checkpoint_id: str | None = Field(default=None, description="Resume from checkpoint")
    checkpoint: dict[str, Any] | None = Field(default=None, description="Full checkpoint object")
    interrupt_before: list[str] | Literal["*"] | None = Field(default=None, description="Nodes to interrupt before")
    interrupt_after: list[str] | Literal["*"] | None = Field(default=None, description="Nodes to interrupt after")
    stream_mode: list[str] | str | None = Field(default=None, description="Stream mode(s)")
    stream_subgraphs: bool = Field(default=False, description="Include subgraph events")
    stream_resumable: bool | None = Field(default=None, description="SSE resumable mode")
    on_disconnect: Literal["cancel", "continue"] = Field(default="cancel", description="Behaviour on SSE disconnect")
    on_completion: Literal["delete", "keep"] = Field(default="keep", description="Delete temp thread on completion")
    multitask_strategy: Literal["reject", "rollback", "interrupt", "enqueue"] = Field(default="reject", description="Concurrency strategy")
    after_seconds: float | None = Field(default=None, description="Delayed execution")
    if_not_exists: Literal["reject", "create"] = Field(default="create", description="Thread creation policy")
    feedback_keys: list[str] | None = Field(default=None, description="LangSmith feedback keys")


class RunResponse(BaseModel):
    run_id: str
    thread_id: str
    assistant_id: str | None = None
    status: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    kwargs: dict[str, Any] = Field(default_factory=dict)
    multitask_strategy: str = "reject"
    created_at: str = ""
    updated_at: str = ""

```

**File:** backend/app/gateway/routers/thread_runs.py (L153-265)
```python
@router.get("/{thread_id}/runs", response_model=list[RunResponse])
async def list_runs(thread_id: str, request: Request) -> list[RunResponse]:
    """List all runs for a thread."""
    run_mgr = get_run_manager(request)
    records = await run_mgr.list_by_thread(thread_id)
    return [_record_to_response(r) for r in records]


@router.get("/{thread_id}/runs/{run_id}", response_model=RunResponse)
async def get_run(thread_id: str, run_id: str, request: Request) -> RunResponse:
    """Get details of a specific run."""
    run_mgr = get_run_manager(request)
    record = run_mgr.get(run_id)
    if record is None or record.thread_id != thread_id:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return _record_to_response(record)


@router.post("/{thread_id}/runs/{run_id}/cancel")
async def cancel_run(
    thread_id: str,
    run_id: str,
    request: Request,
    wait: bool = Query(default=False, description="Block until run completes after cancel"),
    action: Literal["interrupt", "rollback"] = Query(default="interrupt", description="Cancel action"),
) -> Response:
    """Cancel a running or pending run.

    - action=interrupt: Stop execution, keep current checkpoint (can be resumed)
    - action=rollback: Stop execution, revert to pre-run checkpoint state
    - wait=true: Block until the run fully stops, return 204
    - wait=false: Return immediately with 202
    """
    run_mgr = get_run_manager(request)
    record = run_mgr.get(run_id)
    if record is None or record.thread_id != thread_id:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    cancelled = await run_mgr.cancel(run_id, action=action)
    if not cancelled:
        raise HTTPException(
            status_code=409,
            detail=f"Run {run_id} is not cancellable (status: {record.status.value})",
        )

    if wait and record.task is not None:
        try:
            await record.task
        except asyncio.CancelledError:
            pass
        return Response(status_code=204)

    return Response(status_code=202)


@router.get("/{thread_id}/runs/{run_id}/join")
async def join_run(thread_id: str, run_id: str, request: Request) -> StreamingResponse:
    """Join an existing run's SSE stream."""
    bridge = get_stream_bridge(request)
    run_mgr = get_run_manager(request)
    record = run_mgr.get(run_id)
    if record is None or record.thread_id != thread_id:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    return StreamingResponse(
        sse_consumer(bridge, record, request, run_mgr),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.api_route("/{thread_id}/runs/{run_id}/stream", methods=["GET", "POST"], response_model=None)
async def stream_existing_run(
    thread_id: str,
    run_id: str,
    request: Request,
    action: Literal["interrupt", "rollback"] | None = Query(default=None, description="Cancel action"),
    wait: int = Query(default=0, description="Block until cancelled (1) or return immediately (0)"),
):
    """Join an existing run's SSE stream (GET), or cancel-then-stream (POST).

    The LangGraph SDK's ``joinStream`` and ``useStream`` stop button both use
    ``POST`` to this endpoint.  When ``action=interrupt`` or ``action=rollback``
    is present the run is cancelled first; the response then streams any
    remaining buffered events so the client observes a clean shutdown.
    """
    run_mgr = get_run_manager(request)
    record = run_mgr.get(run_id)
    if record is None or record.thread_id != thread_id:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    # Cancel if an action was requested (stop-button / interrupt flow)
    if action is not None:
        cancelled = await run_mgr.cancel(run_id, action=action)
        if cancelled and wait and record.task is not None:
            try:
                await record.task
            except (asyncio.CancelledError, Exception):
                pass
            return Response(status_code=204)

    bridge = get_stream_bridge(request)
    return StreamingResponse(
        sse_consumer(bridge, record, request, run_mgr),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
```

**File:** backend/app/gateway/routers/runs.py (L23-87)
```python
router = APIRouter(prefix="/api/runs", tags=["runs"])


def _resolve_thread_id(body: RunCreateRequest) -> str:
    """Return the thread_id from the request body, or generate a new one."""
    thread_id = (body.config or {}).get("configurable", {}).get("thread_id")
    if thread_id:
        return str(thread_id)
    return str(uuid.uuid4())


@router.post("/stream")
async def stateless_stream(body: RunCreateRequest, request: Request) -> StreamingResponse:
    """Create a run and stream events via SSE.

    If ``config.configurable.thread_id`` is provided, the run is created
    on the given thread so that conversation history is preserved.
    Otherwise a new temporary thread is created.
    """
    thread_id = _resolve_thread_id(body)
    bridge = get_stream_bridge(request)
    run_mgr = get_run_manager(request)
    record = await start_run(body, thread_id, request)

    return StreamingResponse(
        sse_consumer(bridge, record, request, run_mgr),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Location": f"/api/threads/{thread_id}/runs/{record.run_id}",
        },
    )


@router.post("/wait", response_model=dict)
async def stateless_wait(body: RunCreateRequest, request: Request) -> dict:
    """Create a run and block until completion.

    If ``config.configurable.thread_id`` is provided, the run is created
    on the given thread so that conversation history is preserved.
    Otherwise a new temporary thread is created.
    """
    thread_id = _resolve_thread_id(body)
    record = await start_run(body, thread_id, request)

    if record.task is not None:
        try:
            await record.task
        except asyncio.CancelledError:
            pass

    checkpointer = get_checkpointer(request)
    config = {"configurable": {"thread_id": thread_id}}
    try:
        checkpoint_tuple = await checkpointer.aget_tuple(config)
        if checkpoint_tuple is not None:
            checkpoint = getattr(checkpoint_tuple, "checkpoint", {}) or {}
            channel_values = checkpoint.get("channel_values", {})
            return serialize_channel_values(channel_values)
    except Exception:
        logger.exception("Failed to fetch final state for run %s", record.run_id)

    return {"status": record.status.value, "error": record.error}
```

**File:** backend/app/gateway/routers/uploads.py (L30-36)
```python
class UploadResponse(BaseModel):
    """Response model for file upload."""

    success: bool
    files: list[dict[str, str]]
    message: str

```

**File:** backend/app/gateway/routers/artifacts.py (L79-116)
```python
@router.get(
    "/threads/{thread_id}/artifacts/{path:path}",
    summary="Get Artifact File",
    description="Retrieve an artifact file generated by the AI agent. Text and binary files can be viewed inline, while active web content is always downloaded.",
)
async def get_artifact(thread_id: str, path: str, request: Request, download: bool = False) -> Response:
    """Get an artifact file by its path.

    The endpoint automatically detects file types and returns appropriate content types.
    Use the `download` query parameter to force file download for non-active content.

    Args:
        thread_id: The thread ID.
        path: The artifact path with virtual prefix (e.g., mnt/user-data/outputs/file.txt).
        request: FastAPI request object (automatically injected).

    Returns:
        The file content as a FileResponse with appropriate content type:
        - Active content (HTML/XHTML/SVG): Served as download attachment
        - Text files: Plain text with proper MIME type
        - Binary files: Inline display with download option

    Raises:
        HTTPException:
            - 400 if path is invalid or not a file
            - 403 if access denied (path traversal detected)
            - 404 if file not found

    Query Parameters:
        download (bool): If true, forces attachment download for file types that are
            otherwise returned inline or as plain text. Active HTML/XHTML/SVG content
            is always downloaded regardless of this flag.

    Example:
        - Get text file inline: `/api/threads/abc123/artifacts/mnt/user-data/outputs/notes.txt`
        - Download file: `/api/threads/abc123/artifacts/mnt/user-data/outputs/data.csv?download=true`
        - Active web content such as `.html`, `.xhtml`, and `.svg` artifacts is always downloaded
    """
```

**File:** backend/app/gateway/routers/suggestions.py (L15-28)
```python
class SuggestionMessage(BaseModel):
    role: str = Field(..., description="Message role: user|assistant")
    content: str = Field(..., description="Message content as plain text")


class SuggestionsRequest(BaseModel):
    messages: list[SuggestionMessage] = Field(..., description="Recent conversation messages")
    n: int = Field(default=3, ge=1, le=5, description="Number of suggestions to generate")
    model_name: str | None = Field(default=None, description="Optional model override")


class SuggestionsResponse(BaseModel):
    suggestions: list[str] = Field(default_factory=list, description="Suggested follow-up questions")

```

**File:** backend/app/gateway/routers/agents.py (L21-54)
```python
class AgentResponse(BaseModel):
    """Response model for a custom agent."""

    name: str = Field(..., description="Agent name (hyphen-case)")
    description: str = Field(default="", description="Agent description")
    model: str | None = Field(default=None, description="Optional model override")
    tool_groups: list[str] | None = Field(default=None, description="Optional tool group whitelist")
    soul: str | None = Field(default=None, description="SOUL.md content")


class AgentsListResponse(BaseModel):
    """Response model for listing all custom agents."""

    agents: list[AgentResponse]


class AgentCreateRequest(BaseModel):
    """Request body for creating a custom agent."""

    name: str = Field(..., description="Agent name (must match ^[A-Za-z0-9-]+$, stored as lowercase)")
    description: str = Field(default="", description="Agent description")
    model: str | None = Field(default=None, description="Optional model override")
    tool_groups: list[str] | None = Field(default=None, description="Optional tool group whitelist")
    soul: str = Field(default="", description="SOUL.md content — agent personality and behavioral guardrails")


class AgentUpdateRequest(BaseModel):
    """Request body for updating a custom agent."""

    description: str | None = Field(default=None, description="Updated description")
    model: str | None = Field(default=None, description="Updated model override")
    tool_groups: list[str] | None = Field(default=None, description="Updated tool group whitelist")
    soul: str | None = Field(default=None, description="Updated SOUL.md content")

```

**File:** backend/app/gateway/routers/agents.py (L310-373)
```python
class UserProfileResponse(BaseModel):
    """Response model for the global user profile (USER.md)."""

    content: str | None = Field(default=None, description="USER.md content, or null if not yet created")


class UserProfileUpdateRequest(BaseModel):
    """Request body for setting the global user profile."""

    content: str = Field(default="", description="USER.md content — describes the user's background and preferences")


@router.get(
    "/user-profile",
    response_model=UserProfileResponse,
    summary="Get User Profile",
    description="Read the global USER.md file that is injected into all custom agents.",
)
async def get_user_profile() -> UserProfileResponse:
    """Return the current USER.md content.

    Returns:
        UserProfileResponse with content=None if USER.md does not exist yet.
    """
    _require_agents_api_enabled()

    try:
        user_md_path = get_paths().user_md_file
        if not user_md_path.exists():
            return UserProfileResponse(content=None)
        raw = user_md_path.read_text(encoding="utf-8").strip()
        return UserProfileResponse(content=raw or None)
    except Exception as e:
        logger.error(f"Failed to read user profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to read user profile: {str(e)}")


@router.put(
    "/user-profile",
    response_model=UserProfileResponse,
    summary="Update User Profile",
    description="Write the global USER.md file that is injected into all custom agents.",
)
async def update_user_profile(request: UserProfileUpdateRequest) -> UserProfileResponse:
    """Create or overwrite the global USER.md.

    Args:
        request: The update request with the new USER.md content.

    Returns:
        UserProfileResponse with the saved content.
    """
    _require_agents_api_enabled()

    try:
        paths = get_paths()
        paths.base_dir.mkdir(parents=True, exist_ok=True)
        paths.user_md_file.write_text(request.content, encoding="utf-8")
        logger.info(f"Updated USER.md at {paths.user_md_file}")
        return UserProfileResponse(content=request.content or None)
    except Exception as e:
        logger.error(f"Failed to update user profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update user profile: {str(e)}")

```

**File:** backend/app/gateway/routers/assistants_compat.py (L1-33)
```python
"""Assistants compatibility endpoints.

Provides LangGraph Platform-compatible assistants API backed by the
``langgraph.json`` graph registry and ``config.yaml`` agent definitions.

This is a minimal stub that satisfies the ``useStream`` React hook's
initialization requirements (``assistants.search()`` and ``assistants.get()``).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/assistants", tags=["assistants-compat"])


class AssistantResponse(BaseModel):
    assistant_id: str
    graph_id: str
    name: str
    config: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    description: str | None = None
    created_at: str = ""
    updated_at: str = ""
    version: int = 1

```

**File:** backend/app/gateway/routers/channels.py (L15-50)
```python
class ChannelStatusResponse(BaseModel):
    service_running: bool
    channels: dict[str, dict]


class ChannelRestartResponse(BaseModel):
    success: bool
    message: str


@router.get("/", response_model=ChannelStatusResponse)
async def get_channels_status() -> ChannelStatusResponse:
    """Get the status of all IM channels."""
    from app.channels.service import get_channel_service

    service = get_channel_service()
    if service is None:
        return ChannelStatusResponse(service_running=False, channels={})
    status = service.get_status()
    return ChannelStatusResponse(**status)


@router.post("/{name}/restart", response_model=ChannelRestartResponse)
async def restart_channel(name: str) -> ChannelRestartResponse:
    """Restart a specific IM channel."""
    from app.channels.service import get_channel_service

    service = get_channel_service()
    if service is None:
        raise HTTPException(status_code=503, detail="Channel service is not running")

    success = await service.restart_channel(name)
    if success:
        logger.info("Channel %s restarted successfully", name)
        return ChannelRestartResponse(success=True, message=f"Channel {name} restarted successfully")
    else:
```

**File:** backend/CLAUDE.md (L211-211)
```markdown
FastAPI application on port 8001 with health check at `GET /health`.
```
