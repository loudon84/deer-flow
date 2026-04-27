# Studio Runtime 与 DeerFlow 集成架构

本文档描述 Article Studio 的 Runtime 模块如何与 DeerFlow Gateway 集成，实现 AI 运行时的会话管理、事件流消费、人工介入恢复和结果物化。

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Article Studio                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  API Layer                                                                   │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │ runtime_sessions │ │ runtime_events   │ │ runtime_hitl     │            │
│  │ /sessions        │ │ /events, /stream │ │ /resume          │            │
│  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘            │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      RuntimeFacadeService                            │   │
│  │  (编排 session / run / 事件消费 / 结果物化)                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
│           ┌────────────────────┼────────────────────┐                      │
│           ▼                    ▼                    ▼                      │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                 │
│  │SessionService  │ │ EventService   │ │ HitlService    │                 │
│  │(会话生命周期)   │ │(事件持久化)     │ │(HITL审计+消费)  │                 │
│  └────────────────┘ └────────────────┘ └────────────────┘                 │
│                                │                                            │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      DeerFlowAdapter                                │   │
│  │  (HTTP 调用 DeerFlow Gateway /api/threads 等)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DeerFlowEventMapper                              │   │
│  │  (SSE 帧 → Portal 统一事件结构)                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTP/SSE
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DeerFlow Gateway                                    │
│  POST /api/threads                     创建 thread                          │
│  POST /api/threads/{id}/runs/stream    启动/恢复 run，SSE 流式返回           │
│  GET  /api/threads/{id}/state          获取 thread 当前状态                  │
│  POST /api/threads/{id}/history        获取 checkpoint 历史                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ LangGraph Runtime
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LangGraph Agent                                     │
│  (lead_agent / research_agent / ... )                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 目录结构

```
backend/packages/studio/
├── domain/
│   └── runtime/
│       ├── adapters/
│       │   ├── base.py              # RuntimeAdapter 抽象基类
│       │   └── deerflow_adapter.py  # DeerFlow Gateway HTTP 适配器
│       ├── mappers/
│       │   ├── deerflow_event_mapper.py   # SSE 帧 → Portal 事件映射
│       │   └── runtime_result_mapper.py   # Thread state → 文章结果映射
│       ├── dto/
│       │   ├── runtime_session_dto.py     # Session 相关 DTO
│       │   ├── runtime_event_dto.py       # Event 相关 DTO
│       │   ├── runtime_hitl_dto.py        # HITL 相关 DTO
│       │   └── runtime_result_dto.py      # Result 相关 DTO
│       └── services/
│           ├── runtime_session_service.py # Session 生命周期管理
│           ├── runtime_event_service.py   # 事件持久化与 SSE 流
│           ├── runtime_hitl_service.py    # HITL 审计与 resume 流消费
│           ├── runtime_result_service.py  # 结果物化与应用
│           └── runtime_facade_service.py  # 门面服务（编排）
├── repositories/
│   ├── runtime_session_repository.py  # portal_runtime_sessions 集合
│   ├── runtime_event_repository.py    # portal_runtime_events 集合
│   └── runtime_hitl_repository.py     # portal_hitl_actions 集合
├── models/persistence/
│   └── runtime_constants.py           # 事件类型/状态常量
└── api/
    ├── router_runtime_sessions.py     # /api/v1/runtime/sessions
    ├── router_runtime_events.py       # /api/v1/runtime/sessions/{id}/events
    ├── router_runtime_hitl.py         # /api/v1/runtime/sessions/{id}/resume
    └── router_runtime_results.py      # /api/v1/runtime/sessions/{id}/results/latest
```

---

## 3. 核心组件详解

### 3.1 RuntimeAdapter（抽象基类）

**文件**: `domain/runtime/adapters/base.py`

定义与 DeerFlow Gateway 交互的抽象接口：

```python
class RuntimeAdapter(ABC):
    @abstractmethod
    async def create_thread(self) -> str:
        """创建 LangGraph thread，返回 thread_id"""

    @abstractmethod
    async def start_run_stream(
        self, *, thread_id: str, message: str,
        request_context: dict, assistant_id: str,
    ) -> AsyncIterator[dict]:
        """启动 run，SSE 流式返回事件帧"""

    @abstractmethod
    async def resume_run_stream(
        self, *, thread_id: str, resume_value: Any, assistant_id: str,
    ) -> AsyncIterator[dict]:
        """恢复 interrupt 的 run，SSE 流式返回事件帧"""

    @abstractmethod
    async def get_thread_state(self, *, thread_id: str) -> dict:
        """获取 thread 当前状态快照"""

    @abstractmethod
    async def get_thread_history(self, *, thread_id: str, limit: int) -> list[dict]:
        """获取 checkpoint 历史"""
```

### 3.2 DeerFlowAdapter（HTTP 适配器）

**文件**: `domain/runtime/adapters/deerflow_adapter.py`

通过 HTTP 调用 DeerFlow Gateway，核心实现：

#### 3.2.1 SSE 帧配对（`_iter_sse_frames`）

将 SSE 流的 `event:`/`data:` 行配对后 yield 结构化帧：

```python
@staticmethod
async def _iter_sse_frames(resp: httpx.Response) -> AsyncIterator[dict]:
    current_event: str | None = None
    async for line in resp.aiter_lines():
        if line.startswith("event:"):
            current_event = line[6:].strip()
            continue
        if line.startswith("data:"):
            yield {"sse_event": current_event, "raw_line": line}
            current_event = None
            continue
```

**yield 格式**:
```python
{
    "sse_event": "updates" | "custom" | "error" | "end" | ...,
    "raw_line": "data: {...}"
}
```

#### 3.2.2 启动 Run（`start_run_stream`）

```python
async def start_run_stream(self, *, thread_id, message, request_context, assistant_id):
    payload = {
        "input": {"messages": [{"type": "human", "content": [{"type": "text", "text": message}]}]},
        "config": {"recursion_limit": 1000},
        "context": _normalize_context(request_context),
        "stream_mode": ["updates", "custom"],      # 只保留增量事件
        "stream_subgraphs": False,                  # 关闭子图事件，避免重复
        "stream_resumable": True,
        "assistant_id": assistant_id,
        "on_disconnect": "continue",
    }
    async with client.stream("POST", f"/api/threads/{thread_id}/runs/stream", json=payload) as resp:
        async for frame in self._iter_sse_frames(resp):
            yield frame
```

**关键配置说明**:

| 参数 | 值 | 说明 |
|------|---|------|
| `stream_mode` | `["updates", "custom"]` | 只保留节点增量输出和自定义事件，跳过 `values`/`messages` 等冗余快照 |
| `stream_subgraphs` | `False` | 关闭子图事件传播，避免同一逻辑操作产出多帧（重复数据根因） |

### 3.3 DeerFlowEventMapper（事件映射器）

**文件**: `domain/runtime/mappers/deerflow_event_mapper.py`

将 SSE 帧映射为 Portal 统一事件结构。

#### 3.3.1 SSE 事件类型过滤

```python
_PERSIST_SSE_EVENTS: frozenset[str] = frozenset({"updates", "custom"})
```

| SSE event | 是否持久化 | 说明 |
|-----------|-----------|------|
| `updates` | ✅ | 节点增量输出，核心事件 |
| `custom` | ✅ | 用户自定义事件（进度通知等） |
| `values` | ❌ | 全量状态快照，冗余且体积大 |
| `messages` | ❌ | 消息流式块，由 updates 中的 messages 通道覆盖 |
| `metadata` | ❌ | run 元数据 |
| `checkpoints`/`tasks`/`debug` | ❌ | 内部事件 |
| `events` | ❌ | Gateway 不支持 |
| `error`/`end` | ✅ | 特殊处理 |

#### 3.3.2 解析 SSE 帧（`parse_sse_frame`）

```python
def parse_sse_frame(self, sse_event: str | None, raw_line: str) -> Any | None:
    # 1. 按 sse_event 类型过滤
    if sse_event and sse_event not in _PERSIST_SSE_EVENTS:
        if sse_event not in ("error", "end"):
            return None

    # 2. 解析 JSON
    parsed = json.loads(raw[5:].strip())

    # 3. 注入 sse_event 元信息
    parsed["__sse_event__"] = sse_event
    return parsed
```

#### 3.3.3 映射为 Portal 事件（`to_portal_event`）

```python
def to_portal_event(self, parsed: Any, seq: int) -> dict:
    sse_event = parsed.pop("__sse_event__", None)

    # 优先识别内置事件
    if sse_event == "end":
        return {"event_type": "run_end", ...}
    if sse_event == "error":
        return {"event_type": "error", ...}

    # 根据 sse_event 类型精确映射
    if sse_event == "updates":
        return self._map_updates_event(parsed, payload, seq)
    if sse_event == "custom":
        return self._map_custom_event(parsed, payload, seq)
```

#### 3.3.4 Updates 事件子类型识别

```python
def _map_updates_event(self, parsed, payload, seq):
    # LangGraph updates 格式: {node_name: {channel: value}}

    # 1. 检查 messages 通道 → message_delta
    if "messages" in node_output:
        text = self._extract_last_ai_text(msgs)
        return {"event_type": "message_delta", "title": "Assistant 输出", ...}

    # 2. 检查 tool_calls → tool_call
    if "tool_calls" in node_output:
        return {"event_type": "tool_call", ...}

    # 3. 检查 tool_result → tool_result
    if "tool_result" in node_output:
        return {"event_type": "tool_result", ...}

    # 4. 其他 → custom_event
    return {"event_type": "custom_event", "title": f"节点: {node_name}", ...}
```

#### 3.3.5 Raw Event 精简（防止数据膨胀）

```python
def _slim_raw_event(parsed: dict, node_name: str) -> dict:
    """截断 raw_event 中的大体积 messages 列表"""
    for ck, cv in v.items():
        if ck == "messages" and isinstance(cv, list):
            slim[k][ck] = f"[{len(cv)} messages, last truncated]"
        else:
            slim[k][ck] = cv
    return slim
```

### 3.4 RuntimeFacadeService（门面服务）

**文件**: `domain/runtime/services/runtime_facade_service.py`

编排 session / run / 事件消费 / 结果物化的完整流程。

#### 3.4.1 启动 Run 流程

```python
async def start_run(self, session_id, request):
    # 1. 获取 session
    session = await self.session_service.get_by_id(session_id)

    # 2. 标记 streaming 状态
    await self.session_service.mark_streaming(session_id)

    # 3. 写入 run_start 事件
    await self.event_service.save_portal_event(session, {
        "event_type": "run_start",
        "display": {"title": "开始执行", ...},
    })

    # 4. 启动后台消费任务
    asyncio.create_task(self._consume_run(session_id, message, request_context))

    return {"sessionId": session_id, "accepted": True, "status": "streaming"}
```

#### 3.4.2 事件消费循环（`_consume_run`）

```python
async def _consume_run(self, session_id, message, request_context):
    session = await self.session_service.get_by_id(session_id)

    async for frame in self.adapter.start_run_stream(...):
        # 1. 解析 SSE 帧
        parsed = self.mapper.parse_sse_frame(frame.get("sse_event"), frame["raw_line"])
        if not parsed:
            continue

        # 2. 映射为 Portal 事件
        portal_event = self.mapper.to_portal_event(parsed, seq=0)

        # 3. 持久化事件
        await self.event_service.save_portal_event(session, portal_event)

        # 4. 处理特殊事件
        if portal_event["event_type"] == "interrupt":
            await self.session_service.mark_waiting_human(...)
            return

        if portal_event["event_type"] == "run_end":
            await self.session_service.mark_completed(session_id)
            mat = await self.result_service.materialize_latest_result(session_id)
            await self.result_service.persist_job_success_document(...)
            return
```

### 3.5 RuntimeHitlService（人工介入服务）

**文件**: `domain/runtime/services/runtime_hitl_service.py`

处理人工介入恢复流程。

#### 3.5.1 Resume 流程

```python
async def resume_session(self, session_id, request, operator_id):
    session = await self.session_repo.find_by_id(session_id)

    # 1. 写入 HITL 审计记录
    await self.hitl_repo.insert_one({
        "sessionId": session_id,
        "actionType": request.action_type,
        "resumeValue": request.resume_value,
        "operatorId": operator_id,
        ...
    })

    # 2. 更新状态为 streaming
    await self.session_repo.update_status(session_id, "streaming", ...)

    # 3. 启动后台 resume 消费任务
    asyncio.create_task(self._consume_resume(session, request.resume_value))

    return {"sessionId": session_id, "accepted": True, "status": "streaming"}
```

#### 3.5.2 Resume 消费循环（`_consume_resume`）

与 `_consume_run` 类似，但调用 `adapter.resume_run_stream` 并传入 `resume_value`。

### 3.6 RuntimeResultService（结果物化服务）

**文件**: `domain/runtime/services/runtime_result_service.py`

从 DeerFlow thread state 提取文章结果并持久化。

#### 3.6.1 结果物化流程

```python
async def materialize_latest_result(self, session_id):
    session = await self.session_repo.find_by_id(session_id)

    # 1. 获取 thread state
    state = await self.adapter.get_thread_state(thread_id=session["threadId"])

    # 2. 从 state 提取结果
    out = self.mapper.from_thread_state(state)
    if not out:
        # 3. fallback: 从 history 提取
        hist = await self.adapter.get_thread_history(thread_id=...)
        out = self.mapper.from_history_entries(hist)

    # 4. 持久化到 session
    await self.session_repo.set_materialized_result(session_id, payload)

    return payload
```

#### 3.6.2 结果应用到文档

```python
async def apply_result_to_document(self, document_id, result_id, body):
    # 1. 获取物化结果
    mat = session.get("materializedResult")

    # 2. 应用到文档（replace/append/new_version）
    ok, ver = await self.document_repo.apply_runtime_result(
        document_id,
        title=mat["title"],
        content_markdown=mat["content"],
        apply_mode=body.apply_mode,
    )

    return {"documentId": document_id, "applied": True, "newVersion": ver}
```

---

## 4. 数据流详解

### 4.1 完整事件流

```
用户请求 POST /api/v1/runtime/sessions/{id}/runs
    │
    ▼
RuntimeFacadeService.start_run()
    │
    ├─► 标记 session 状态为 streaming
    │
    ├─► 写入 run_start 事件到 MongoDB
    │
    └─► asyncio.create_task(_consume_run)
            │
            ▼
        DeerFlowAdapter.start_run_stream()
            │
            │  HTTP POST /api/threads/{id}/runs/stream
            │  stream_mode=["updates","custom"], stream_subgraphs=False
            │
            ▼
        DeerFlow Gateway SSE 流
            │
            │  event: updates
            │  data: {"agent": {"messages": [...], ...}}
            │
            │  event: custom
            │  data: {"type": "progress", "value": 50}
            │
            │  event: end
            │  data: null
            │
            ▼
        DeerFlowAdapter._iter_sse_frames()
            │
            │  配对 event:/data: 行
            │  yield {"sse_event": "updates", "raw_line": "data: {...}"}
            │
            ▼
        DeerFlowEventMapper.parse_sse_frame()
            │
            │  按 sse_event 类型过滤
            │  解析 JSON，注入 __sse_event__
            │
            ▼
        DeerFlowEventMapper.to_portal_event()
            │
            │  根据 sse_event 精确映射
            │  updates → message_delta / tool_call / custom_event
            │  custom → custom_event
            │
            ▼
        RuntimeEventService.save_portal_event()
            │
            │  原子递增 lastEventSeq
            │  写入 portal_runtime_events 集合
            │
            ▼
        检查事件类型
            │
            ├─► interrupt → mark_waiting_human() → return
            │
            └─► run_end → mark_completed() → materialize_latest_result() → return
```

### 4.2 Resume 流程

```
用户请求 POST /api/v1/runtime/sessions/{id}/resume
    │
    ▼
RuntimeHitlService.resume_session()
    │
    ├─► 写入 HITL 审计记录到 portal_hitl_actions
    │
    ├─► 更新 session 状态为 streaming
    │
    └─► asyncio.create_task(_consume_resume)
            │
            ▼
        DeerFlowAdapter.resume_run_stream()
            │
            │  payload.input = {"command": {"resume": resume_value}}
            │
            ▼
        (后续流程与 _consume_run 相同)
```

---

## 5. MongoDB 集合设计

### 5.1 portal_runtime_sessions

```javascript
{
    "_id": "sess_xxx",
    "ownerType": "job" | "document",
    "ownerId": "job_xxx" | "doc_xxx",
    "userId": "user_xxx",
    "runtimeProvider": "deerflow",
    "assistantId": "lead_agent",
    "threadId": "thread_xxx",           // LangGraph thread ID
    "latestRunId": "run_xxx",
    "status": "idle" | "streaming" | "waiting_human" | "completed" | "failed",
    "runtimeStatus": {
        "phase": "not_started" | "running",
        "streaming": false,
        "waitingHuman": false,
        "completed": false,
        "failed": false
    },
    "requestContext": {
        "modelName": "gpt-4",
        "mode": "pro",
        "reasoningEffort": "high",
        "thinkingEnabled": true,
        "planMode": false,
        "subagentEnabled": false
    },
    "currentInterrupt": {
        "kind": "approval",
        "prompt": "请确认是否继续...",
        "raw": {...}
    },
    "summary": {
        "latestAssistantText": "...",
        "latestResultType": "article_draft",
        "latestResultId": "res_xxx",
        "lastEventSeq": 42
    },
    "materializedResult": {
        "resultId": "res_xxx",
        "resultType": "article_draft",
        "title": "文章标题",
        "content": "Markdown 内容...",
        "createdAt": "2024-01-01T00:00:00Z"
    },
    "createdAt": ISODate("..."),
    "updatedAt": ISODate("...")
}
```

**索引**:
- `threadId` (unique)
- `(ownerType, ownerId, createdAt)`
- `(userId, updatedAt)`
- `(status, updatedAt)`

### 5.2 portal_runtime_events

```javascript
{
    "_id": "evt_xxx",
    "sessionId": ObjectId("sess_xxx"),
    "ownerType": "job",
    "ownerId": "job_xxx",
    "threadId": "thread_xxx",
    "seq": 42,                          // 单调递增序号
    "eventType": "message_delta" | "tool_call" | "custom_event" | "interrupt" | "run_end" | ...,
    "source": "assistant" | "tool" | "system",
    "display": {
        "title": "Assistant 输出",
        "content": "文本内容...",
        "severity": "info" | "success" | "warning" | "error"
    },
    "rawEvent": {...},                  // 精简后的原始事件数据
    "createdAt": ISODate("...")
}
```

**索引**:
- `(sessionId, seq)` (unique)
- `(ownerType, ownerId, seq)`
- `(threadId, seq)`
- `(eventType, createdAt)`

### 5.3 portal_hitl_actions

```javascript
{
    "_id": "hitl_xxx",
    "sessionId": ObjectId("sess_xxx"),
    "ownerType": "job",
    "ownerId": "job_xxx",
    "threadId": "thread_xxx",
    "interruptSeq": 20,                 // 触发 interrupt 时的事件序号
    "actionType": "approve" | "reject" | "revise" | "custom_resume",
    "resumeValue": {...},
    "operatorId": "user_xxx",
    "comment": "继续生成正文",
    "createdAt": ISODate("...")
}
```

**索引**:
- `(sessionId, createdAt)`
- `(ownerType, ownerId, createdAt)`
- `(operatorId, createdAt)`

---

## 6. 事件类型定义

**文件**: `models/persistence/runtime_constants.py`

| 常量 | 值 | 说明 |
|------|---|------|
| `RUNTIME_EVENT_RUN_START` | `run_start` | Run 启动 |
| `RUNTIME_EVENT_MESSAGE_DELTA` | `message_delta` | Assistant 消息增量 |
| `RUNTIME_EVENT_MESSAGE_FINAL` | `message_final` | 最终消息 |
| `RUNTIME_EVENT_TOOL_CALL` | `tool_call` | 工具调用 |
| `RUNTIME_EVENT_TOOL_RESULT` | `tool_result` | 工具结果 |
| `RUNTIME_EVENT_VALUE_SNAPSHOT` | `value_snapshot` | 状态快照 |
| `RUNTIME_EVENT_CUSTOM_EVENT` | `custom_event` | 自定义事件 |
| `RUNTIME_EVENT_SUBGRAPH_EVENT` | `subgraph_event` | 子图事件 |
| `RUNTIME_EVENT_INTERRUPT` | `interrupt` | 人工介入中断 |
| `RUNTIME_EVENT_RESUME` | `resume` | 恢复执行 |
| `RUNTIME_EVENT_RUN_END` | `run_end` | Run 结束 |
| `RUNTIME_EVENT_ERROR` | `error` | 错误 |
| `RUNTIME_EVENT_RESULT_MATERIALIZED` | `result_materialized` | 结果已物化 |
| `RUNTIME_EVENT_DOCUMENT_PERSISTED` | `document_persisted` | 文档已持久化 |

---

## 7. API 端点

### 7.1 Session 管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/runtime/sessions` | POST | 创建或获取 session |
| `/api/v1/runtime/sessions/{id}` | GET | 获取 session 详情 |
| `/api/v1/runtime/sessions/{id}/runs` | POST | 启动一次 run |
| `/api/v1/runtime/sessions/{id}/history` | GET | 获取 session 历史 |

### 7.2 事件查询

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/runtime/sessions/{id}/events` | GET | 游标式拉取事件 |
| `/api/v1/runtime/sessions/{id}/stream` | GET | SSE 流式推送事件 |

### 7.3 人工介入

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/runtime/sessions/{id}/resume` | POST | 恢复 interrupt 的 session |

### 7.4 结果管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/runtime/sessions/{id}/results/latest` | GET | 获取最新物化结果 |
| `/api/v1/documents/{id}/runtime-results/{resultId}/apply` | POST | 将结果应用到文档 |

---

## 8. 配置项

**文件**: `settings/studio_settings.py`

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `STUDIO_DEERFLOW_BASE_URL` | - | DeerFlow Gateway 根地址 |
| `STUDIO_DEERFLOW_AGENT_NAME` | `opus-reviewer` | 默认 agent 名称 |
| `STUDIO_DEERFLOW_MODE` | `pro` | 默认运行模式 |
| `STUDIO_DEERFLOW_REASONING_EFFORT` | `high` | 默认推理强度 |
| `STUDIO_USE_RUNTIME_FACADE` | `True` | 是否启用 Runtime Facade |

---

## 9. 重复数据问题与解决方案

### 9.1 问题根因

| 根因 | 说明 |
|------|------|
| `stream_subgraphs=True` | 子图每个内部节点产出一帧 updates，父图视角再产出一帧汇总，内容高度重叠 |
| adapter 逐行 yield | mapper 无法获取 SSE event 类型，只能启发式判断 |
| mapper 无去重 | 所有 updates 事件统一归为 custom_event，不区分子类型 |
| raw_event 存储完整 messages | 每条事件记录都存一份完整 messages 列表，数据膨胀严重 |

### 9.2 解决方案

| 方案 | 修改位置 | 效果 |
|------|---------|------|
| 关闭 `stream_subgraphs` | `deerflow_adapter.py` | 每个节点只产出一帧 updates，消除重复 |
| adapter 配对 event/data 行 | `_iter_sse_frames()` | yield 结构化帧，携带 sse_event 类型 |
| mapper 精确过滤 | `parse_sse_frame()` | 按 sse_event 类型白名单过滤 |
| mapper 精确映射 | `to_portal_event()` | 识别 message_delta/tool_call/tool_result 子类型 |
| raw_event 精简 | `_slim_raw_event()` | 截断 messages 列表，只保留数量摘要 |

---

## 10. 调试指南

### 10.1 查看 SSE 原始帧

在 `DeerFlowAdapter._iter_sse_frames` 中添加日志：

```python
async for line in resp.aiter_lines():
    logger.debug("SSE line: %s", line[:200])
    ...
```

### 10.2 查看事件映射结果

在 `DeerFlowEventMapper.to_portal_event` 中添加日志：

```python
def to_portal_event(self, parsed, seq):
    result = ...
    logger.debug("Portal event: type=%s, title=%s", result["event_type"], result["display"]["title"])
    return result
```

### 10.3 查看 MongoDB 事件

```javascript
db.portal_runtime_events.find({sessionId: ObjectId("sess_xxx")}).sort({seq: 1})
```

### 10.4 常见问题排查

| 问题 | 排查步骤 |
|------|---------|
| 事件重复 | 检查 `stream_subgraphs` 是否为 False |
| 事件缺失 | 检查 `_PERSIST_SSE_EVENTS` 白名单 |
| 数据膨胀 | 检查 `_slim_raw_event` 是否生效 |
| SSE 连接失败 | 检查 `STUDIO_DEERFLOW_BASE_URL` 配置 |

---

## 11. 扩展点

### 11.1 支持新的 Runtime Provider

1. 实现 `RuntimeAdapter` 抽象基类
2. 在 `RuntimeFacadeService` 中根据 `runtime_provider` 选择 adapter
3. 如需新事件类型，在 `runtime_constants.py` 中定义

### 11.2 支持新的事件类型

1. 在 `runtime_constants.py` 中定义常量
2. 在 `DeerFlowEventMapper._map_updates_event` 或 `_map_custom_event` 中添加识别逻辑
3. 在 `models/persistence/__init__.py` 中导出常量

### 11.3 支持子图事件（未来）

当需要恢复 `stream_subgraphs=True` 时：

1. 修改 DeerFlow Gateway 的 `_unpack_stream_item`，保留 namespace 信息
2. 在 SSE 帧的 data 中传递 `__ns__` 字段
3. 在 mapper 中根据 `__ns__` 区分父图/子图事件，跳过父图视角的汇总帧

---

## 12. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2024-01 | 初始版本 |
| 1.1 | 2024-01 | 关闭 stream_subgraphs，解决重复数据问题 |
| 1.2 | 2024-01 | 重写 mapper，支持精确事件类型映射 |
