# DeerFlow Project Semantic Overview

## Purpose

DeerFlow 是一个**基于 LangGraph 的生产级 AI Super Agent 框架**，而非聊天机器人 SDK 或 LLM 封装层。它的设计意图是：在每个对话线程内提供隔离的、具备持久记忆、沙箱执行、子智能体委托和可扩展工具集成能力的完整 Agent 运行时。系统的核心价值主张在于**可插拔性**（模型/工具/沙箱/保护策略均通过反射机制动态加载）与**层次隔离**（Harness 框架包与应用层严格分离）。 [1](#0-0) 

## Core Architecture

**双进程后端 + 严格单向依赖图**

```
Nginx(:2026)
 ├── /api/langgraph/* → LangGraph Server(:2024)   [Agent Runtime]
 ├── /api/*          → Gateway API(:8001)           [Auxiliary REST]
 └── /              → Next.js Frontend(:3000)       [UI]
```

**Harness / App 二元分层**是全系统最重要的结构性决策：

- **`deerflow.*`（Harness 层）**：可发布的框架包，包含 Agent 编排、中间件链、工具系统、沙箱、模型工厂、MCP、Skills、记忆系统、反射加载器，以及内嵌客户端 `DeerFlowClient`。对 `app.*` 零依赖。
- **`app.*`（应用层）**：不可发布的应用代码，仅含 FastAPI Gateway 和 IM 渠道集成（Feishu/Slack/Telegram）。单向依赖 `deerflow.*`。 [2](#0-1) [3](#0-2) 

**反射加载机制**是系统级扩展的底层基础。`resolve_variable()` 和 `resolve_class()` 通过 `module.path:VariableName` 字符串在运行时动态绑定模型类、工具实例、沙箱提供者、Guardrail Provider。所有 `config.yaml` 中的 `use:` 字段都通过此机制解析。 [4](#0-3) 

## Key Modules

**`deerflow/agents/lead_agent/agent.py`**：系统唯一的 Agent 工厂入口 `make_lead_agent(config: RunnableConfig)`，在 `langgraph.json` 中注册为 LangGraph Server 的 graph 入口。Agent 以 `ThreadState` 为状态 Schema，中间件链在此处顺序组装，工具集通过 `get_available_tools()` 动态聚合。 [5](#0-4) 

**`deerflow/agents/thread_state.py`**：`ThreadState`（继承 `AgentState`）是跨中间件共享的唯一状态契约。`merge_artifacts` 和 `merge_viewed_images` 是自定义 Reducer，对并发 state update 语义有直接影响。 [6](#0-5) 

**`deerflow/agents/middlewares/`**：中间件是系统行为的主要扩展单元，当前 12 个中间件。执行顺序在 `_build_middlewares()` 中硬编码，顺序依赖关系由注释文档记录（ThreadData → Uploads → Sandbox → DanglingToolCall → Guardrail → Summarization → TodoList → Title → Memory → ViewImage → DeferredToolFilter → SubagentLimit → LoopDetection → Clarification）。 [7](#0-6) 

**`deerflow/sandbox/sandbox.py`**：`Sandbox` 抽象基类（`execute_command`, `read_file`, `write_file`, `list_dir`, `update_file`）是沙箱扩展的稳定契约。`SandboxProvider` 协议管理 acquire/get/release 生命周期。虚拟路径 `/mnt/user-data/` → 物理路径翻译在此层完成。 [8](#0-7) 

**`deerflow/guardrails/provider.py`**：`GuardrailProvider` 是 Protocol（structural subtyping），不需要继承基类。实现类需提供 `name: str`、`evaluate(request) -> GuardrailDecision`、`aevaluate(request) -> GuardrailDecision` 三个成员。通过 `resolve_variable()` 加载，是最轻量级的扩展点。 [9](#0-8) 

**`deerflow/tools/tools.py`**：`get_available_tools()` 聚合三类工具：(1) `config.yaml` 中 `use:` 路径反射加载的配置工具，(2) 缓存的 MCP 工具（带 mtime 失效），(3) 内置工具（`present_files`, `ask_clarification`, `view_image`, `task`）。 [10](#0-9) 

**`deerflow/models/factory.py`**：`create_chat_model()` 通过 `resolve_class()` 动态实例化任意 `BaseChatModel` 子类，支持 thinking 模式参数合并、vision 能力检测、OpenAI Responses API 适配。 [11](#0-10) 

**`deerflow/subagents/executor.py`**：双线程池架构（`_scheduler_pool` 3 workers + `_execution_pool` 3 workers），全局 `_background_tasks` dict 存储任务状态，通过 `SubagentLimitMiddleware` 在模型输出侧截断超出 `MAX_CONCURRENT_SUBAGENTS` 的并发 task 调用。 [12](#0-11) 

**`app/channels/base.py`**：`Channel` 抽象基类定义 IM 渠道的 `start/stop/send` 生命周期，通过 `MessageBus` 发布/消费 `InboundMessage`/`OutboundMessage`。新渠道需实现此基类并在 `service.py` 中注册。 [13](#0-12) 

**`deerflow/client.py`**：`DeerFlowClient` 是无 HTTP 服务的内嵌客户端，所有返回类型与 Gateway API Pydantic 模型对齐，由 `TestGatewayConformance` 在 CI 中强制验证。嵌入式部署场景（非 Web）应通过此类而非 HTTP 接入。 [14](#0-13) 

**Frontend `src/core/`**：业务逻辑核心。`threads/hooks.ts`（`useThreadStream`, `useSubmitThread`, `useThreads`）是前端与 LangGraph SDK 的主要接口边界。`core/api/` 中的 `getAPIClient()` 返回单例 LangGraph 客户端。`components/ui/` 和 `components/ai-elements/` 是代码生成目录，禁止手动修改。 [15](#0-14) [16](#0-15) 

## Lifecycle

**系统启动**

`config.yaml` 在项目根目录解析（优先级：显式参数 > `DEER_FLOW_CONFIG_PATH` env > 当前目录 > 父目录）。`get_app_config()` 缓存解析结果并监听 mtime 变化实现热重载，无需重启进程。 [17](#0-16) 

**每次 Agent 调用**

`make_lead_agent(config)` 根据 `config.configurable` 中的运行时参数（`model_name`, `thinking_enabled`, `is_plan_mode`, `subagent_enabled`, `agent_name`）动态组装中间件链和工具集，Agent 实例不跨请求缓存。`ThreadState` 通过 LangGraph checkpointer 持久化，sandbox 在 `SandboxMiddleware` 中按 thread 生命周期 acquire/release。 [18](#0-17) 

**MCP 工具缓存**

MCP 工具在第一次 `get_available_tools()` 调用时懒加载，通过 `extensions_config.json` 的 mtime 变化触发失效重载。Gateway API 对 `extensions_config.json` 的写入即触发下次调用时重新加载。 [19](#0-18) 

**记忆更新**

`MemoryMiddleware` → `MemoryQueue`（30s debounce）→ 后台线程 LLM 提取 → 原子写入 `memory.json`（tmp 文件 rename），注入上限 15 条 facts + 3 段 context。 [20](#0-19) 

**IM 渠道消息流**

外部平台 → `Channel.impl` → `MessageBus.publish_inbound()` → `ChannelManager._dispatch_loop()` → LangGraph SDK（`runs.stream()` for Feishu / `runs.wait()` for Slack/Telegram）→ `OutboundMessage` → `Channel.send()`。 [21](#0-20) 

## Extension Points

**显式扩展点（设计即为扩展而预留）**

新增 LLM：在 `config.yaml` `models[]` 中添加 `use: module:ClassName`（必须是 `BaseChatModel` 子类），声明 `supports_thinking` / `supports_vision` / `when_thinking_enabled`。 [22](#0-21) 

新增 Tool：在 `config.yaml` `tools[]` 中添加 `use: module:tool_variable`（必须是 `BaseTool` 实例），分配 `group`。或实现 MCP Server 并在 `extensions_config.json` 中注册。 [23](#0-22) 

新增 Sandbox：实现 `Sandbox` 抽象类和对应的 `SandboxProvider`，在 `config.yaml` `sandbox.use` 中指定类路径。参考 `LocalSandboxProvider` 或 `AioSandboxProvider`。 [24](#0-23) 

新增 Guardrail：实现 `GuardrailProvider` Protocol（structural，无需继承），在 `config.yaml` `guardrails` 中配置 `use:` 路径即可插入中间件链。 [9](#0-8) 

新增 IM 渠道：继承 `app/channels/base.py` 的 `Channel`，实现 `start/stop/send`，在 `app/channels/service.py` 中注册。 [25](#0-24) 

新增 Skill：在 `skills/custom/` 下创建包含 `SKILL.md`（YAML frontmatter）的目录，或通过 `POST /api/skills/install` 上传 `.skill` ZIP 包。 [26](#0-25) 

新增 Middleware：实现中间件类，在 `_build_middlewares()` 中按依赖顺序插入。**注意顺序约束：`ClarificationMiddleware` 必须最后，`ThreadDataMiddleware` 必须最前。** [27](#0-26) 

**隐式扩展点（约定而非接口）**

`deerflow/community/` 目录是社区工具的放置位置，无正式注册机制，遵循与 `tools[]` 相同的 `BaseTool` 约定即可。

子智能体通过 `BUILTIN_SUBAGENTS` dict（`deerflow/subagents/builtins/`）注册，当前无运行时动态注册路径，新增 subagent 需修改源码。 [28](#0-27) 

## Constraints（不可违反的不变式）

**依赖方向铁律**：`deerflow.*` 绝不可 import `app.*`。该约束由 `tests/test_harness_boundary.py` AST 扫描在 CI 中机械执行，违反即 CI 失败。 [29](#0-28) 

**`ClarificationMiddleware` 必须是中间件链的最后一个**，它通过 `Command(goto=END)` 中断执行流，任何在其后的中间件不会被调用。 [30](#0-29) 

**`ThreadState` Schema 变更有级联风险**：`merge_artifacts`（去重）和 `merge_viewed_images`（空 dict 清空语义）是自定义 Reducer，修改这两个函数会影响所有使用 artifacts 和图像注入的中间件行为。 [31](#0-30) 

**虚拟路径隔离不可绕过**：Agent 看到的路径 `/mnt/user-data/` 需经 `replace_virtual_path()` 翻译为物理路径 `backend/.deer-flow/threads/{thread_id}/`，sandbox tools 外的任何直接文件操作应视为越界。 [32](#0-31) 

**`DeerFlowClient` 与 Gateway API 返回格式必须对齐**：`TestGatewayConformance` 测试套件通过 Pydantic 解析验证两者一致性，新增 Gateway endpoint 若没有同步更新 `DeerFlowClient`，CI 将捕获 schema drift。 [33](#0-32) 

**Config Schema 变更需同步 bump `config_version`**：`config.example.yaml` 中的 `config_version` 字段用于检测用户配置文件是否过时，变更 Schema 后必须递增此版本并通过 `make config-upgrade` 测试升级路径。 [34](#0-33) 

**并发子智能体上限**：`MAX_CONCURRENT_SUBAGENTS`（默认 3）由 `SubagentLimitMiddleware` 在模型输出侧截断，同时受双线程池（`_scheduler_pool` + `_execution_pool` 各 3 workers）物理限制约束，二者需保持一致。 [35](#0-34) 

**TDD 为强制要求**：所有功能变更必须附带 `backend/tests/test_<feature>.py` 单元测试，Harness 层新模块如引发循环导入，需在 `tests/conftest.py` 中添加 `sys.modules` mock。 [36](#0-35) 

**前端生成代码禁止手动编辑**：`frontend/src/components/ui/` 和 `frontend/src/components/ai-elements/` 由 Shadcn/MagicUI 等 registry 生成，手动改动在下次 registry 同步时将被覆盖。 [37](#0-36) 

## Risk Surface（高风险修改区域）

`_build_middlewares()` 中的中间件排序：顺序变更可能破坏状态依赖（如 `ThreadDataMiddleware` 未执行时 `sandbox_id` 不可用）。

`get_available_tools()` 的工具聚合逻辑：`reset_deferred_registry()` 必须在 MCP 工具加载前调用以防 stale 状态，顺序敏感。 [38](#0-37) 

`create_chat_model()` 的 thinking 参数合并逻辑：涉及 OpenAI-compatible gateway、native Anthropic、Codex Responses API 三个不同的 API 约定，分支覆盖有隐患。 [39](#0-38) 

`MemoryMiddleware` 的后台异步写入：与 `get_app_config()` 的 mtime 缓存失效并发时存在 TOCTOU 窗口，`memory.json` 通过原子 rename 写入可防止文件损坏，但多进程场景无分布式锁。 [40](#0-39) 

## Notes

- DeerFlow 不是一个多租户 SaaS 系统，当前记忆、线程数据均以文件系统为后端，`backend/.deer-flow/` 目录是单节点单租户假设的物化体现。
- `DeerFlowClient` 提供无服务器内嵌模式，这是 CI 集成测试和非 Web 场景的推荐接入路径，而非 HTTP Gateway。
- 前端没有配置测试框架，所有测试覆盖集中在后端 `backend/tests/`。
- Nginx 是唯一外部入口点，绕过 Nginx 直接访问 LangGraph(:2024) 或 Gateway(:8001) 时不受路由策略保护。

### Citations

**File:** backend/CLAUDE.md (L7-14)
```markdown
DeerFlow is a LangGraph-based AI super agent system with a full-stack architecture. The backend provides a "super agent" with sandbox execution, persistent memory, subagent delegation, and extensible tool integration - all operating in per-thread isolated environments.

**Architecture**:
- **LangGraph Server** (port 2024): Agent runtime and workflow execution
- **Gateway API** (port 8001): REST API for models, MCP, skills, memory, artifacts, uploads, and local thread cleanup
- **Frontend** (port 3000): Next.js web interface
- **Nginx** (port 2026): Unified reverse proxy entry point
- **Provisioner** (port 8002, optional in Docker dev): Started only when sandbox is configured for provisioner/Kubernetes mode
```

**File:** backend/CLAUDE.md (L108-131)
```markdown

The backend is split into two layers with a strict dependency direction:

- **Harness** (`packages/harness/deerflow/`): Publishable agent framework package (`deerflow-harness`). Import prefix: `deerflow.*`. Contains agent orchestration, tools, sandbox, models, MCP, skills, config — everything needed to build and run agents.
- **App** (`app/`): Unpublished application code. Import prefix: `app.*`. Contains the FastAPI Gateway API and IM channel integrations (Feishu, Slack, Telegram).

**Dependency rule**: App imports deerflow, but deerflow never imports app. This boundary is enforced by `tests/test_harness_boundary.py` which runs in CI.

**Import conventions**:
```python
# Harness internal
from deerflow.agents import make_lead_agent
from deerflow.models import create_chat_model

# App internal
from app.gateway.app import app
from app.channels.service import start_channel_service

# App → Harness (allowed)
from deerflow.config import get_app_config

# Harness → App (FORBIDDEN — enforced by test_harness_boundary.py)
# from app.gateway.routers.uploads import ...  # ← will fail CI
```
```

**File:** backend/CLAUDE.md (L163-166)
```markdown
9. **MemoryMiddleware** - Queues conversations for async memory update (filters to user + final AI responses)
10. **ViewImageMiddleware** - Injects base64 image data before LLM call (conditional on vision support)
11. **SubagentLimitMiddleware** - Truncates excess `task` tool calls from model response to enforce `MAX_CONCURRENT_SUBAGENTS` limit (optional, if subagent_enabled)
12. **ClarificationMiddleware** - Intercepts `ask_clarification` tool calls, interrupts via `Command(goto=END)` (must be last)
```

**File:** backend/CLAUDE.md (L173-175)
```markdown

**Config Versioning**: `config.example.yaml` has a `config_version` field. On startup, `AppConfig.from_file()` compares user version vs example version and emits a warning if outdated. Missing `config_version` = version 0. Run `make config-upgrade` to auto-merge missing fields. When changing the config schema, bump `config_version` in `config.example.yaml`.

```

**File:** backend/CLAUDE.md (L177-184)
```markdown

Configuration priority:
1. Explicit `config_path` argument
2. `DEER_FLOW_CONFIG_PATH` environment variable
3. `config.yaml` in current directory (backend/)
4. `config.yaml` in parent directory (project root - **recommended location**)

Config values starting with `$` are resolved as environment variables (e.g., `$OPENAI_API_KEY`).
```

**File:** backend/CLAUDE.md (L217-229)
```markdown

**Interface**: Abstract `Sandbox` with `execute_command`, `read_file`, `write_file`, `list_dir`
**Provider Pattern**: `SandboxProvider` with `acquire`, `get`, `release` lifecycle
**Implementations**:
- `LocalSandboxProvider` - Singleton local filesystem execution with path mappings
- `AioSandboxProvider` (`packages/harness/deerflow/community/`) - Docker-based isolation

**Virtual Path System**:
- Agent sees: `/mnt/user-data/{workspace,uploads,outputs}`, `/mnt/skills`
- Physical: `backend/.deer-flow/threads/{thread_id}/user-data/...`, `deer-flow/skills/`
- Translation: `replace_virtual_path()` / `replace_virtual_paths_in_command()`
- Detection: `is_local_sandbox()` checks `sandbox_id == "local"`

```

**File:** backend/CLAUDE.md (L241-244)
```markdown
**Concurrency**: `MAX_CONCURRENT_SUBAGENTS = 3` enforced by `SubagentLimitMiddleware` (truncates excess tool calls in `after_model`), 15-minute timeout
**Flow**: `task()` tool → `SubagentExecutor` → background thread → poll 5s → SSE events → result
**Events**: `task_started`, `task_running`, `task_completed`/`task_failed`/`task_timed_out`

```

**File:** backend/CLAUDE.md (L263-271)
```markdown
### MCP System (`packages/harness/deerflow/mcp/`)

- Uses `langchain-mcp-adapters` `MultiServerMCPClient` for multi-server management
- **Lazy initialization**: Tools loaded on first use via `get_cached_mcp_tools()`
- **Cache invalidation**: Detects config file changes via mtime comparison
- **Transports**: stdio (command-based), SSE, HTTP
- **OAuth (HTTP/SSE)**: Supports token endpoint flows (`client_credentials`, `refresh_token`) with automatic token refresh + Authorization header injection
- **Runtime updates**: Gateway API saves to extensions_config.json; LangGraph detects via mtime

```

**File:** backend/CLAUDE.md (L272-279)
```markdown
### Skills System (`packages/harness/deerflow/skills/`)

- **Location**: `deer-flow/skills/{public,custom}/`
- **Format**: Directory with `SKILL.md` (YAML frontmatter: name, description, license, allowed-tools)
- **Loading**: `load_skills()` recursively scans `skills/{public,custom}` for `SKILL.md`, parses metadata, and reads enabled state from extensions_config.json
- **Injection**: Enabled skills listed in agent system prompt with container paths
- **Installation**: `POST /api/skills/install` extracts .skill ZIP archive to custom/ directory

```

**File:** backend/CLAUDE.md (L301-316)
```markdown

**Message Flow**:
1. External platform -> Channel impl -> `MessageBus.publish_inbound()`
2. `ChannelManager._dispatch_loop()` consumes from queue
3. For chat: look up/create thread on LangGraph Server
4. Feishu chat: `runs.stream()` → accumulate AI text → publish multiple outbound updates (`is_final=False`) → publish final outbound (`is_final=True`)
5. Slack/Telegram chat: `runs.wait()` → extract final response → publish outbound
6. Feishu channel sends one running reply card up front, then patches the same card for each outbound update (card JSON sets `config.update_multi=true` for Feishu's patch API requirement)
7. For commands (`/new`, `/status`, `/models`, `/memory`, `/help`): handle locally or query Gateway API
8. Outbound → channel callbacks → platform reply

**Configuration** (`config.yaml` -> `channels`):
- `langgraph_url` - LangGraph Server URL (default: `http://localhost:2024`)
- `gateway_url` - Gateway API URL for auxiliary commands (default: `http://localhost:8001`)
- Per-channel configs: `feishu` (app_id, app_secret), `slack` (bot_token, app_token), `telegram` (bot_token)

```

**File:** backend/CLAUDE.md (L329-344)
```markdown
**Workflow**:
1. `MemoryMiddleware` filters messages (user inputs + final AI responses) and queues conversation
2. Queue debounces (30s default), batches updates, deduplicates per-thread
3. Background thread invokes LLM to extract context updates and facts
4. Applies updates atomically (temp file + rename) with cache invalidation, skipping duplicate fact content before append
5. Next interaction injects top 15 facts + context into `<memory>` tags in system prompt

Focused regression coverage for the updater lives in `backend/tests/test_memory_updater.py`.

**Configuration** (`config.yaml` → `memory`):
- `enabled` / `injection_enabled` - Master switches
- `storage_path` - Path to memory.json
- `debounce_seconds` - Wait time before processing (default: 30)
- `model_name` - LLM for updates (null = default model)
- `max_facts` / `fact_confidence_threshold` - Fact storage limits (100 / 0.7)
- `max_injection_tokens` - Token limit for prompt injection (2000)
```

**File:** backend/CLAUDE.md (L370-402)
```markdown
### Embedded Client (`packages/harness/deerflow/client.py`)

`DeerFlowClient` provides direct in-process access to all DeerFlow capabilities without HTTP services. All return types align with the Gateway API response schemas, so consumer code works identically in HTTP and embedded modes.

**Architecture**: Imports the same `deerflow` modules that LangGraph Server and Gateway API use. Shares the same config files and data directories. No FastAPI dependency.

**Agent Conversation** (replaces LangGraph Server):
- `chat(message, thread_id)` — synchronous, returns final text
- `stream(message, thread_id)` — yields `StreamEvent` aligned with LangGraph SSE protocol:
  - `"values"` — full state snapshot (title, messages, artifacts)
  - `"messages-tuple"` — per-message update (AI text, tool calls, tool results)
  - `"end"` — stream finished
- Agent created lazily via `create_agent()` + `_build_middlewares()`, same as `make_lead_agent`
- Supports `checkpointer` parameter for state persistence across turns
- `reset_agent()` forces agent recreation (e.g. after memory or skill changes)

**Gateway Equivalent Methods** (replaces Gateway API):

| Category | Methods | Return format |
|----------|---------|---------------|
| Models | `list_models()`, `get_model(name)` | `{"models": [...]}`, `{name, display_name, ...}` |
| MCP | `get_mcp_config()`, `update_mcp_config(servers)` | `{"mcp_servers": {...}}` |
| Skills | `list_skills()`, `get_skill(name)`, `update_skill(name, enabled)`, `install_skill(path)` | `{"skills": [...]}` |
| Memory | `get_memory()`, `reload_memory()`, `get_memory_config()`, `get_memory_status()` | dict |
| Uploads | `upload_files(thread_id, files)`, `list_uploads(thread_id)`, `delete_upload(thread_id, filename)` | `{"success": true, "files": [...]}`, `{"files": [...], "count": N}` |
| Artifacts | `get_artifact(thread_id, path)` → `(bytes, mime_type)` | tuple |

**Key difference from Gateway**: Upload accepts local `Path` objects instead of HTTP `UploadFile`, rejects directory paths before copying, and reuses a single worker when document conversion must run inside an active event loop. Artifact returns `(bytes, mime_type)` instead of HTTP Response. The new Gateway-only thread cleanup route deletes `.deer-flow/threads/{thread_id}` after LangGraph thread deletion; there is no matching `DeerFlowClient` method yet. `update_mcp_config()` and `update_skill()` automatically invalidate the cached agent.

**Tests**: `tests/test_client.py` (77 unit tests including `TestGatewayConformance`), `tests/test_client_live.py` (live integration tests, requires config.yaml)

**Gateway Conformance Tests** (`TestGatewayConformance`): Validate that every dict-returning client method conforms to the corresponding Gateway Pydantic response model. Each test parses the client output through the Gateway model — if Gateway adds a required field that the client doesn't provide, Pydantic raises `ValidationError` and CI catches the drift. Covers: `ModelsListResponse`, `ModelResponse`, `SkillsListResponse`, `SkillResponse`, `SkillInstallResponse`, `McpConfigResponse`, `UploadResponse`, `MemoryConfigResponse`, `MemoryStatusResponse`.

```

**File:** backend/CLAUDE.md (L405-413)
```markdown
### Test-Driven Development (TDD) — MANDATORY

**Every new feature or bug fix MUST be accompanied by unit tests. No exceptions.**

- Write tests in `backend/tests/` following the existing naming convention `test_<feature>.py`
- Run the full suite before and after your change: `make test`
- Tests must pass before a feature is considered complete
- For lightweight config/utility modules, prefer pure unit tests with no external dependencies
- If a module causes circular import issues in tests, add a `sys.modules` mock in `tests/conftest.py` (see existing example for `deerflow.subagents.executor`)
```

**File:** backend/tests/test_harness_boundary.py (L1-45)
```python
"""Boundary check: harness layer must not import from app layer.

The deerflow-harness package (packages/harness/deerflow/) is a standalone,
publishable agent framework. It must never depend on the app layer (app/).

This test scans all Python files in the harness package and fails if any
``from app.`` or ``import app.`` statement is found.
"""

import ast
from pathlib import Path

HARNESS_ROOT = Path(__file__).parent.parent / "packages" / "harness" / "deerflow"

BANNED_PREFIXES = ("app.",)


def _collect_imports(filepath: Path) -> list[tuple[int, str]]:
    """Return (line_number, module_path) for every import in *filepath*."""
    source = filepath.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source, filename=str(filepath))
    except SyntaxError:
        return []

    results: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                results.append((node.lineno, alias.name))
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                results.append((node.lineno, node.module))
    return results


def test_harness_does_not_import_app():
    violations: list[str] = []

    for py_file in sorted(HARNESS_ROOT.rglob("*.py")):
        for lineno, module in _collect_imports(py_file):
            if any(module == prefix.rstrip(".") or module.startswith(prefix) for prefix in BANNED_PREFIXES):
                rel = py_file.relative_to(HARNESS_ROOT.parent.parent.parent)
                violations.append(f"  {rel}:{lineno}  imports {module}")

```

**File:** backend/packages/harness/deerflow/reflection/resolvers.py (L25-70)
```python
def resolve_variable[T](
    variable_path: str,
    expected_type: type[T] | tuple[type, ...] | None = None,
) -> T:
    """Resolve a variable from a path.

    Args:
        variable_path: The path to the variable (e.g. "parent_package_name.sub_package_name.module_name:variable_name").
        expected_type: Optional type or tuple of types to validate the resolved variable against.
            If provided, uses isinstance() to check if the variable is an instance of the expected type(s).

    Returns:
        The resolved variable.

    Raises:
        ImportError: If the module path is invalid or the attribute doesn't exist.
        ValueError: If the resolved variable doesn't pass the validation checks.
    """
    try:
        module_path, variable_name = variable_path.rsplit(":", 1)
    except ValueError as err:
        raise ImportError(f"{variable_path} doesn't look like a variable path. Example: parent_package_name.sub_package_name.module_name:variable_name") from err

    try:
        module = import_module(module_path)
    except ImportError as err:
        module_root = module_path.split(".", 1)[0]
        err_name = getattr(err, "name", None)
        if isinstance(err, ModuleNotFoundError) or err_name == module_root:
            hint = _build_missing_dependency_hint(module_path, err)
            raise ImportError(f"Could not import module {module_path}. {hint}") from err
        # Preserve the original ImportError message for non-missing-module failures.
        raise ImportError(f"Error importing module {module_path}: {err}") from err

    try:
        variable = getattr(module, variable_name)
    except AttributeError as err:
        raise ImportError(f"Module {module_path} does not define a {variable_name} attribute/class") from err

    # Type validation
    if expected_type is not None:
        if not isinstance(variable, expected_type):
            type_name = expected_type.__name__ if isinstance(expected_type, type) else " or ".join(t.__name__ for t in expected_type)
            raise ValueError(f"{variable_path} is not an instance of {type_name}, got {type(variable).__name__}")

    return variable
```

**File:** backend/packages/harness/deerflow/agents/lead_agent/agent.py (L197-260)
```python
# ThreadDataMiddleware must be before SandboxMiddleware to ensure thread_id is available
# UploadsMiddleware should be after ThreadDataMiddleware to access thread_id
# DanglingToolCallMiddleware patches missing ToolMessages before model sees the history
# SummarizationMiddleware should be early to reduce context before other processing
# TodoListMiddleware should be before ClarificationMiddleware to allow todo management
# TitleMiddleware generates title after first exchange
# MemoryMiddleware queues conversation for memory update (after TitleMiddleware)
# ViewImageMiddleware should be before ClarificationMiddleware to inject image details before LLM
# ToolErrorHandlingMiddleware should be before ClarificationMiddleware to convert tool exceptions to ToolMessages
# ClarificationMiddleware should be last to intercept clarification requests after model calls
def _build_middlewares(config: RunnableConfig, model_name: str | None, agent_name: str | None = None):
    """Build middleware chain based on runtime configuration.

    Args:
        config: Runtime configuration containing configurable options like is_plan_mode.
        agent_name: If provided, MemoryMiddleware will use per-agent memory storage.

    Returns:
        List of middleware instances.
    """
    middlewares = build_lead_runtime_middlewares(lazy_init=True)

    # Add summarization middleware if enabled
    summarization_middleware = _create_summarization_middleware()
    if summarization_middleware is not None:
        middlewares.append(summarization_middleware)

    # Add TodoList middleware if plan mode is enabled
    is_plan_mode = config.get("configurable", {}).get("is_plan_mode", False)
    todo_list_middleware = _create_todo_list_middleware(is_plan_mode)
    if todo_list_middleware is not None:
        middlewares.append(todo_list_middleware)

    # Add TitleMiddleware
    middlewares.append(TitleMiddleware())

    # Add MemoryMiddleware (after TitleMiddleware)
    middlewares.append(MemoryMiddleware(agent_name=agent_name))

    # Add ViewImageMiddleware only if the current model supports vision.
    # Use the resolved runtime model_name from make_lead_agent to avoid stale config values.
    app_config = get_app_config()
    model_config = app_config.get_model_config(model_name) if model_name else None
    if model_config is not None and model_config.supports_vision:
        middlewares.append(ViewImageMiddleware())

    # Add DeferredToolFilterMiddleware to hide deferred tool schemas from model binding
    if app_config.tool_search.enabled:
        from deerflow.agents.middlewares.deferred_tool_filter_middleware import DeferredToolFilterMiddleware
        middlewares.append(DeferredToolFilterMiddleware())

    # Add SubagentLimitMiddleware to truncate excess parallel task calls
    subagent_enabled = config.get("configurable", {}).get("subagent_enabled", False)
    if subagent_enabled:
        max_concurrent_subagents = config.get("configurable", {}).get("max_concurrent_subagents", 3)
        middlewares.append(SubagentLimitMiddleware(max_concurrent=max_concurrent_subagents))

    # LoopDetectionMiddleware — detect and break repetitive tool call loops
    middlewares.append(LoopDetectionMiddleware())

    # ClarificationMiddleware should always be last
    middlewares.append(ClarificationMiddleware())
    return middlewares

```

**File:** backend/packages/harness/deerflow/agents/lead_agent/agent.py (L262-336)
```python
def make_lead_agent(config: RunnableConfig):
    # Lazy import to avoid circular dependency
    from deerflow.tools import get_available_tools
    from deerflow.tools.builtins import setup_agent

    cfg = config.get("configurable", {})

    thinking_enabled = cfg.get("thinking_enabled", True)
    reasoning_effort = cfg.get("reasoning_effort", None)
    requested_model_name: str | None = cfg.get("model_name") or cfg.get("model")
    is_plan_mode = cfg.get("is_plan_mode", False)
    subagent_enabled = cfg.get("subagent_enabled", False)
    max_concurrent_subagents = cfg.get("max_concurrent_subagents", 3)
    is_bootstrap = cfg.get("is_bootstrap", False)
    agent_name = cfg.get("agent_name")

    agent_config = load_agent_config(agent_name) if not is_bootstrap else None
    # Custom agent model or fallback to global/default model resolution
    agent_model_name = agent_config.model if agent_config and agent_config.model else _resolve_model_name()

    # Final model name resolution with request override, then agent config, then global default
    model_name = requested_model_name or agent_model_name

    app_config = get_app_config()
    model_config = app_config.get_model_config(model_name) if model_name else None

    if model_config is None:
        raise ValueError("No chat model could be resolved. Please configure at least one model in config.yaml or provide a valid 'model_name'/'model' in the request.")
    if thinking_enabled and not model_config.supports_thinking:
        logger.warning(f"Thinking mode is enabled but model '{model_name}' does not support it; fallback to non-thinking mode.")
        thinking_enabled = False

    logger.info(
        "Create Agent(%s) -> thinking_enabled: %s, reasoning_effort: %s, model_name: %s, is_plan_mode: %s, subagent_enabled: %s, max_concurrent_subagents: %s",
        agent_name or "default",
        thinking_enabled,
        reasoning_effort,
        model_name,
        is_plan_mode,
        subagent_enabled,
        max_concurrent_subagents,
    )

    # Inject run metadata for LangSmith trace tagging
    if "metadata" not in config:
        config["metadata"] = {}

    config["metadata"].update(
        {
            "agent_name": agent_name or "default",
            "model_name": model_name or "default",
            "thinking_enabled": thinking_enabled,
            "reasoning_effort": reasoning_effort,
            "is_plan_mode": is_plan_mode,
            "subagent_enabled": subagent_enabled,
        }
    )

    if is_bootstrap:
        # Special bootstrap agent with minimal prompt for initial custom agent creation flow
        return create_agent(
            model=create_chat_model(name=model_name, thinking_enabled=thinking_enabled),
            tools=get_available_tools(model_name=model_name, subagent_enabled=subagent_enabled) + [setup_agent],
            middleware=_build_middlewares(config, model_name=model_name),
            system_prompt=apply_prompt_template(subagent_enabled=subagent_enabled, max_concurrent_subagents=max_concurrent_subagents, available_skills=set(["bootstrap"])),
            state_schema=ThreadState,
        )

    # Default lead agent (unchanged behavior)
    return create_agent(
        model=create_chat_model(name=model_name, thinking_enabled=thinking_enabled, reasoning_effort=reasoning_effort),
        tools=get_available_tools(model_name=model_name, groups=agent_config.tool_groups if agent_config else None, subagent_enabled=subagent_enabled),
        middleware=_build_middlewares(config, model_name=model_name, agent_name=agent_name),
        system_prompt=apply_prompt_template(subagent_enabled=subagent_enabled, max_concurrent_subagents=max_concurrent_subagents, agent_name=agent_name),
        state_schema=ThreadState,
```

**File:** backend/packages/harness/deerflow/agents/thread_state.py (L21-55)
```python
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

**File:** backend/packages/harness/deerflow/sandbox/sandbox.py (L4-72)
```python
class Sandbox(ABC):
    """Abstract base class for sandbox environments"""

    _id: str

    def __init__(self, id: str):
        self._id = id

    @property
    def id(self) -> str:
        return self._id

    @abstractmethod
    def execute_command(self, command: str) -> str:
        """Execute bash command in sandbox.

        Args:
            command: The command to execute.

        Returns:
            The standard or error output of the command.
        """
        pass

    @abstractmethod
    def read_file(self, path: str) -> str:
        """Read the content of a file.

        Args:
            path: The absolute path of the file to read.

        Returns:
            The content of the file.
        """
        pass

    @abstractmethod
    def list_dir(self, path: str, max_depth=2) -> list[str]:
        """List the contents of a directory.

        Args:
            path: The absolute path of the directory to list.
            max_depth: The maximum depth to traverse. Default is 2.

        Returns:
            The contents of the directory.
        """
        pass

    @abstractmethod
    def write_file(self, path: str, content: str, append: bool = False) -> None:
        """Write content to a file.

        Args:
            path: The absolute path of the file to write to.
            content: The text content to write to the file.
            append: Whether to append the content to the file. If False, the file will be created or overwritten.
        """
        pass

    @abstractmethod
    def update_file(self, path: str, content: bytes) -> None:
        """Update a file with binary content.

        Args:
            path: The absolute path of the file to update.
            content: The binary content to write to the file.
        """
        pass
```

**File:** backend/packages/harness/deerflow/guardrails/provider.py (L39-55)
```python
@runtime_checkable
class GuardrailProvider(Protocol):
    """Contract for pluggable tool-call authorization.

    Any class with these methods works - no base class required.
    Providers are loaded by class path via resolve_variable(),
    the same mechanism DeerFlow uses for models, tools, and sandbox.
    """

    name: str

    def evaluate(self, request: GuardrailRequest) -> GuardrailDecision:
        """Evaluate whether a tool call should proceed."""
        ...

    async def aevaluate(self, request: GuardrailRequest) -> GuardrailDecision:
        """Async variant."""
```

**File:** backend/packages/harness/deerflow/tools/tools.py (L23-101)
```python
def get_available_tools(
    groups: list[str] | None = None,
    include_mcp: bool = True,
    model_name: str | None = None,
    subagent_enabled: bool = False,
) -> list[BaseTool]:
    """Get all available tools from config.

    Note: MCP tools should be initialized at application startup using
    `initialize_mcp_tools()` from deerflow.mcp module.

    Args:
        groups: Optional list of tool groups to filter by.
        include_mcp: Whether to include tools from MCP servers (default: True).
        model_name: Optional model name to determine if vision tools should be included.
        subagent_enabled: Whether to include subagent tools (task, task_status).

    Returns:
        List of available tools.
    """
    config = get_app_config()
    loaded_tools = [resolve_variable(tool.use, BaseTool) for tool in config.tools if groups is None or tool.group in groups]

    # Conditionally add tools based on config
    builtin_tools = BUILTIN_TOOLS.copy()

    # Add subagent tools only if enabled via runtime parameter
    if subagent_enabled:
        builtin_tools.extend(SUBAGENT_TOOLS)
        logger.info("Including subagent tools (task)")

    # If no model_name specified, use the first model (default)
    if model_name is None and config.models:
        model_name = config.models[0].name

    # Add view_image_tool only if the model supports vision
    model_config = config.get_model_config(model_name) if model_name else None
    if model_config is not None and model_config.supports_vision:
        builtin_tools.append(view_image_tool)
        logger.info(f"Including view_image_tool for model '{model_name}' (supports_vision=True)")

    # Get cached MCP tools if enabled
    # NOTE: We use ExtensionsConfig.from_file() instead of config.extensions
    # to always read the latest configuration from disk. This ensures that changes
    # made through the Gateway API (which runs in a separate process) are immediately
    # reflected when loading MCP tools.
    mcp_tools = []
    # Reset deferred registry upfront to prevent stale state from previous calls
    reset_deferred_registry()
    if include_mcp:
        try:
            from deerflow.config.extensions_config import ExtensionsConfig
            from deerflow.mcp.cache import get_cached_mcp_tools

            extensions_config = ExtensionsConfig.from_file()
            if extensions_config.get_enabled_mcp_servers():
                mcp_tools = get_cached_mcp_tools()
                if mcp_tools:
                    logger.info(f"Using {len(mcp_tools)} cached MCP tool(s)")

                    # When tool_search is enabled, register MCP tools in the
                    # deferred registry and add tool_search to builtin tools.
                    if config.tool_search.enabled:
                        from deerflow.tools.builtins.tool_search import DeferredToolRegistry, set_deferred_registry
                        from deerflow.tools.builtins.tool_search import tool_search as tool_search_tool

                        registry = DeferredToolRegistry()
                        for t in mcp_tools:
                            registry.register(t)
                        set_deferred_registry(registry)
                        builtin_tools.append(tool_search_tool)
                        logger.info(f"Tool search active: {len(mcp_tools)} tools deferred")
        except ImportError:
            logger.warning("MCP module not available. Install 'langchain-mcp-adapters' package to enable MCP tools.")
        except Exception as e:
            logger.error(f"Failed to get cached MCP tools: {e}")

    logger.info(f"Total tools loaded: {len(loaded_tools)}, built-in tools: {len(builtin_tools)}, MCP tools: {len(mcp_tools)}")
    return loaded_tools + builtin_tools + mcp_tools
```

**File:** backend/packages/harness/deerflow/models/factory.py (L11-80)
```python
def create_chat_model(name: str | None = None, thinking_enabled: bool = False, **kwargs) -> BaseChatModel:
    """Create a chat model instance from the config.

    Args:
        name: The name of the model to create. If None, the first model in the config will be used.

    Returns:
        A chat model instance.
    """
    config = get_app_config()
    if name is None:
        name = config.models[0].name
    model_config = config.get_model_config(name)
    if model_config is None:
        raise ValueError(f"Model {name} not found in config") from None
    model_class = resolve_class(model_config.use, BaseChatModel)
    model_settings_from_config = model_config.model_dump(
        exclude_none=True,
        exclude={
            "use",
            "name",
            "display_name",
            "description",
            "supports_thinking",
            "supports_reasoning_effort",
            "when_thinking_enabled",
            "thinking",
            "supports_vision",
        },
    )
    # Compute effective when_thinking_enabled by merging in the `thinking` shortcut field.
    # The `thinking` shortcut is equivalent to setting when_thinking_enabled["thinking"].
    has_thinking_settings = (model_config.when_thinking_enabled is not None) or (model_config.thinking is not None)
    effective_wte: dict = dict(model_config.when_thinking_enabled) if model_config.when_thinking_enabled else {}
    if model_config.thinking is not None:
        merged_thinking = {**(effective_wte.get("thinking") or {}), **model_config.thinking}
        effective_wte = {**effective_wte, "thinking": merged_thinking}
    if thinking_enabled and has_thinking_settings:
        if not model_config.supports_thinking:
            raise ValueError(f"Model {name} does not support thinking. Set `supports_thinking` to true in the `config.yaml` to enable thinking.") from None
        if effective_wte:
            model_settings_from_config.update(effective_wte)
    if not thinking_enabled and has_thinking_settings:
        if effective_wte.get("extra_body", {}).get("thinking", {}).get("type"):
            # OpenAI-compatible gateway: thinking is nested under extra_body
            kwargs.update({"extra_body": {"thinking": {"type": "disabled"}}})
            kwargs.update({"reasoning_effort": "minimal"})
        elif effective_wte.get("thinking", {}).get("type"):
            # Native langchain_anthropic: thinking is a direct constructor parameter
            kwargs.update({"thinking": {"type": "disabled"}})
    if not model_config.supports_reasoning_effort and "reasoning_effort" in kwargs:
        del kwargs["reasoning_effort"]

    # For Codex Responses API models: map thinking mode to reasoning_effort
    from deerflow.models.openai_codex_provider import CodexChatModel

    if issubclass(model_class, CodexChatModel):
        # The ChatGPT Codex endpoint currently rejects max_tokens/max_output_tokens.
        model_settings_from_config.pop("max_tokens", None)

        # Use explicit reasoning_effort from frontend if provided (low/medium/high)
        explicit_effort = kwargs.pop("reasoning_effort", None)
        if not thinking_enabled:
            model_settings_from_config["reasoning_effort"] = "none"
        elif explicit_effort and explicit_effort in ("low", "medium", "high", "xhigh"):
            model_settings_from_config["reasoning_effort"] = explicit_effort
        elif "reasoning_effort" not in model_settings_from_config:
            model_settings_from_config["reasoning_effort"] = "medium"

    model_instance = model_class(**kwargs, **model_settings_from_config)
```

**File:** backend/packages/harness/deerflow/subagents/executor.py (L66-75)
```python
# Global storage for background task results
_background_tasks: dict[str, SubagentResult] = {}
_background_tasks_lock = threading.Lock()

# Thread pool for background task scheduling and orchestration
_scheduler_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="subagent-scheduler-")

# Thread pool for actual subagent execution (with timeout support)
# Larger pool to avoid blocking when scheduler submits execution tasks
_execution_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="subagent-exec-")
```

**File:** backend/app/channels/base.py (L14-60)
```python
class Channel(ABC):
    """Base class for all IM channel implementations.

    Each channel connects to an external messaging platform and:
    1. Receives messages, wraps them as InboundMessage, publishes to the bus.
    2. Subscribes to outbound messages and sends replies back to the platform.

    Subclasses must implement ``start``, ``stop``, and ``send``.
    """

    def __init__(self, name: str, bus: MessageBus, config: dict[str, Any]) -> None:
        self.name = name
        self.bus = bus
        self.config = config
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running

    # -- lifecycle ---------------------------------------------------------

    @abstractmethod
    async def start(self) -> None:
        """Start listening for messages from the external platform."""

    @abstractmethod
    async def stop(self) -> None:
        """Gracefully stop the channel."""

    # -- outbound ----------------------------------------------------------

    @abstractmethod
    async def send(self, msg: OutboundMessage) -> None:
        """Send a message back to the external platform.

        The implementation should use ``msg.chat_id`` and ``msg.thread_ts``
        to route the reply to the correct conversation/thread.
        """

    async def send_file(self, msg: OutboundMessage, attachment: ResolvedAttachment) -> bool:
        """Upload a single file attachment to the platform.

        Returns True if the upload succeeded, False otherwise.
        Default implementation returns False (no file upload support).
        """
        return False
```

**File:** frontend/CLAUDE.md (L43-57)
```markdown
- **`core/`** — Business logic, the heart of the app:
  - `threads/` — Thread creation, streaming, state management (hooks + types)
  - `api/` — LangGraph client singleton
  - `artifacts/` — Artifact loading and caching
  - `i18n/` — Internationalization (en-US, zh-CN)
  - `settings/` — User preferences in localStorage
  - `memory/` — Persistent user memory system
  - `skills/` — Skills installation and management
  - `messages/` — Message processing and transformation
  - `mcp/` — Model Context Protocol integration
  - `models/` — TypeScript types and data models
- **`hooks/`** — Shared React hooks
- **`lib/`** — Utilities (`cn()` from clsx + tailwind-merge)
- **`server/`** — Server-side code (better-auth, not yet active)
- **`styles/`** — Global CSS with Tailwind v4 `@import` syntax and CSS variables for theming
```

**File:** frontend/CLAUDE.md (L67-72)
```markdown

- **Server Components by default**, `"use client"` only for interactive components
- **Thread hooks** (`useThreadStream`, `useSubmitThread`, `useThreads`) are the primary API interface
- **LangGraph client** is a singleton obtained via `getAPIClient()` in `core/api/`
- **Environment validation** uses `@t3-oss/env-nextjs` with Zod schemas (`src/env.js`). Skip with `SKIP_ENV_VALIDATION=1`

```

**File:** frontend/CLAUDE.md (L78-80)
```markdown
- **Path alias**: `@/*` maps to `src/*`.
- **Components**: `ui/` and `ai-elements/` are generated from registries (Shadcn, MagicUI, React Bits, Vercel AI SDK) — don't manually edit these.

```

**File:** config.example.yaml (L22-92)
```yaml
models:
  # Example: Volcengine (Doubao) model
  # - name: doubao-seed-1.8
  #   display_name: Doubao-Seed-1.8
  #   use: deerflow.models.patched_deepseek:PatchedChatDeepSeek
  #   model: doubao-seed-1-8-251228
  #   api_base: https://ark.cn-beijing.volces.com/api/v3
  #   api_key: $VOLCENGINE_API_KEY
  #   supports_thinking: true
  #   supports_vision: true
  #   supports_reasoning_effort: true
  #   when_thinking_enabled:
  #     extra_body:
  #       thinking:
  #         type: enabled

  # Example: OpenAI model
  # - name: gpt-4
  #   display_name: GPT-4
  #   use: langchain_openai:ChatOpenAI
  #   model: gpt-4
  #   api_key: $OPENAI_API_KEY # Use environment variable
  #   max_tokens: 4096
  #   temperature: 0.7
  #   supports_vision: true # Enable vision support for view_image tool

  # Example: OpenAI Responses API model
  # - name: gpt-5-responses
  #   display_name: GPT-5 (Responses API)
  #   use: langchain_openai:ChatOpenAI
  #   model: gpt-5
  #   api_key: $OPENAI_API_KEY
  #   use_responses_api: true
  #   output_version: responses/v1
  #   supports_vision: true

  # Example: Anthropic Claude model
  # - name: claude-3-5-sonnet
  #   display_name: Claude 3.5 Sonnet
  #   use: langchain_anthropic:ChatAnthropic
  #   model: claude-3-5-sonnet-20241022
  #   api_key: $ANTHROPIC_API_KEY
  #   max_tokens: 8192
  #   supports_vision: true  # Enable vision support for view_image tool
  #   when_thinking_enabled:
  #     thinking:
  #       type: enabled

  # Example: Google Gemini model
  # - name: gemini-2.5-pro
  #   display_name: Gemini 2.5 Pro
  #   use: langchain_google_genai:ChatGoogleGenerativeAI
  #   model: gemini-2.5-pro
  #   google_api_key: $GOOGLE_API_KEY
  #   max_tokens: 8192
  #   supports_vision: true

  # Example: DeepSeek model (with thinking support)
  # - name: deepseek-v3
  #   display_name: DeepSeek V3 (Thinking)
  #   use: deerflow.models.patched_deepseek:PatchedChatDeepSeek
  #   model: deepseek-reasoner
  #   api_key: $DEEPSEEK_API_KEY
  #   max_tokens: 16384
  #   supports_thinking: true
  #   supports_vision: false  # DeepSeek V3 does not support vision
  #   when_thinking_enabled:
  #     extra_body:
  #       thinking:
  #         type: enabled

```

**File:** config.example.yaml (L176-213)
```yaml
tools:
  # Web search tool (requires Tavily API key)
  - name: web_search
    group: web
    use: deerflow.community.tavily.tools:web_search_tool
    max_results: 5
    # api_key: $TAVILY_API_KEY  # Set if needed

  # Web search tool (uses InfoQuest, requires InfoQuest API key)
  # - name: web_search
  #   group: web
  #   use: deerflow.community.infoquest.tools:web_search_tool
  #   # Used to limit the scope of search results, only returns content within the specified time range. Set to -1 to disable time filtering
  #   search_time_range: 10

  # Web fetch tool (uses Jina AI reader)
  - name: web_fetch
    group: web
    use: deerflow.community.jina_ai.tools:web_fetch_tool
    timeout: 10

  # Web fetch tool (uses InfoQuest)
  # - name: web_fetch
  #   group: web
  #   use: deerflow.community.infoquest.tools:web_fetch_tool
  #   # Overall timeout for the entire crawling process (in seconds). Set to positive value to enable, -1 to disable
  #   timeout: 10
  #   # Waiting time after page loading (in seconds). Set to positive value to enable, -1 to disable
  #   fetch_time: 10
  #   # Timeout for navigating to the page (in seconds). Set to positive value to enable, -1 to disable
  #   navigation_timeout: 30

  # Image search tool (uses DuckDuckGo)
  # Use this to find reference images before image generation
  - name: image_search
    group: web
    use: deerflow.community.image_search.tools:image_search_tool
    max_results: 5
```

**File:** backend/packages/harness/deerflow/subagents/registry.py (L1-44)
```python
"""Subagent registry for managing available subagents."""

import logging
from dataclasses import replace

from deerflow.subagents.builtins import BUILTIN_SUBAGENTS
from deerflow.subagents.config import SubagentConfig

logger = logging.getLogger(__name__)


def get_subagent_config(name: str) -> SubagentConfig | None:
    """Get a subagent configuration by name, with config.yaml overrides applied.

    Args:
        name: The name of the subagent.

    Returns:
        SubagentConfig if found (with any config.yaml overrides applied), None otherwise.
    """
    config = BUILTIN_SUBAGENTS.get(name)
    if config is None:
        return None

    # Apply timeout override from config.yaml (lazy import to avoid circular deps)
    from deerflow.config.subagents_config import get_subagents_app_config

    app_config = get_subagents_app_config()
    effective_timeout = app_config.get_timeout_for(name)
    if effective_timeout != config.timeout_seconds:
        logger.debug(f"Subagent '{name}': timeout overridden by config.yaml ({config.timeout_seconds}s -> {effective_timeout}s)")
        config = replace(config, timeout_seconds=effective_timeout)

    return config


def list_subagents() -> list[SubagentConfig]:
    """List all available subagent configurations (with config.yaml overrides applied).

    Returns:
        List of all registered SubagentConfig instances.
    """
    return [get_subagent_config(name) for name in BUILTIN_SUBAGENTS]

```
