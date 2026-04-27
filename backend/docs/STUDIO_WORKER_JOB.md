# Studio Worker Job 状态管理完整链路分析

## 概述

本文档详细分析了 `backend/packages/studio` 目录下 Job 状态管理的完整链路，包括：
- Job 状态常量定义
- Session 状态常量定义
- Job 状态转换的完整流程
- Session 与 Job 状态的同步机制
- 已知问题与修复方案

---

## 1. Job 状态常量定义

**文件**: `backend/packages/studio/models/persistence/job_doc.py`

| 常量 | 值 | 含义 |
|---|---|---|
| `JOB_STATUS_QUEUED` | `"queued"` | 排队中 |
| `JOB_STATUS_RUNNING` | `"running"` | 运行中 |
| `JOB_STATUS_WAITING_HUMAN` | `"waiting_human"` | 等待人工(HITL) |
| `JOB_STATUS_SUCCEEDED` | `"succeeded"` | 成功 |
| `JOB_STATUS_FAILED` | `"failed"` | 失败 |
| `JOB_STATUS_CANCELLED` | `"cancelled"` | 已取消 |

**终态**: `succeeded`, `failed`, `cancelled`

```python
# 任务状态常量
JOB_STATUS_QUEUED = "queued"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_WAITING_HUMAN = "waiting_human"
JOB_STATUS_SUCCEEDED = "succeeded"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"

# 终态
JOB_FINAL_STATUSES = [
    JOB_STATUS_SUCCEEDED,
    JOB_STATUS_FAILED,
    JOB_STATUS_CANCELLED,
]
```

---

## 2. Session 状态常量定义

**文件**: `backend/packages/studio/models/persistence/runtime_constants.py`

| 常量 | 值 |
|---|---|
| `RUNTIME_SESSION_STATUS_IDLE` | `"idle"` |
| `RUNTIME_SESSION_STATUS_STREAMING` | `"streaming"` |
| `RUNTIME_SESSION_STATUS_WAITING_HUMAN` | `"waiting_human"` |
| `RUNTIME_SESSION_STATUS_COMPLETED` | `"completed"` |
| `RUNTIME_SESSION_STATUS_FAILED` | `"failed"` |
| `RUNTIME_SESSION_STATUS_CANCELLED` | `"cancelled"` |

---

## 3. 核心类与文件

| 类名 | 文件路径 | 职责 |
|---|---|---|
| `ArticleGenerationService` | `services/article_generation_service.py` | 文章生成服务，协调 Job 执行 |
| `JobRepository` | `repositories/job_repository.py` | Job 数据访问层，状态更新方法 |
| `RuntimeFacadeService` | `domain/runtime/services/runtime_facade_service.py` | Runtime 编排服务，消费 DeerFlow 事件 |
| `RuntimeSessionService` | `domain/runtime/services/runtime_session_service.py` | Session 生命周期管理 |
| `RuntimeResultService` | `domain/runtime/services/runtime_result_service.py` | 结果物化与持久化 |
| `ArticleRuntimeExecutionService` | `services/article_runtime_execution_service.py` | 通过 RuntimeFacade 执行 Job |
| `GenerationWorker` | `workers/generation_worker.py` | Worker 轮询调度 |

---

## 4. Job 状态转换完整链路

### 4.1 `queued` → `running`：Worker 拾取 Job

**触发流程**:

```
GenerationWorker._process_jobs()
  → job_repo.find_queued_jobs(limit=10)   # 查询 status="queued" 的 jobs
  → generation_service.execute_job(job_id)
```

**关键代码**:

`workers/generation_worker.py:38-66`:
```python
async def _process_jobs(self):
    jobs = await self.job_repo.find_queued_jobs(limit=10)
    if not jobs:
        return
    tasks = [self._process_job(job) for job in jobs]
    await asyncio.gather(*tasks, return_exceptions=True)

async def _process_job(self, job: dict):
    job_id = str(job["_id"])
    document_id = await self.generation_service.execute_job(job_id)
```

`services/article_generation_service.py:147-155`:
```python
async def execute_job(self, job_id: str) -> str | None:
    job = await self.job_repo.find_by_id(job_id)
    # ★ 状态转换: queued → running
    await self.job_repo.set_running(job_id)
```

`repositories/job_repository.py:88-90`:
```python
async def set_running(self, job_id: str) -> bool:
    return await self.update_status(job_id, JOB_STATUS_RUNNING)
```

---

### 4.2 `running` → `succeeded` / `failed`：两条路径

#### 路径 A — 传统策略模式 (`use_runtime_facade=False`)

`services/article_generation_service.py:172-262`:

```python
try:
    # 执行生成策略
    result = await strategy.execute(...)
    
    # 创建文档
    document_id = await self.document_repo.create(document_data)
    
    # ★ 成功: running → succeeded
    await self.job_repo.set_succeeded(job_id, document_id)
    return document_id

except Exception as e:
    # ★ 失败: running → failed
    await self.job_repo.set_failed(job_id, error_msg)
    raise
```

#### 路径 B — Runtime Facade 模式 (`use_runtime_facade=True`)

`services/article_generation_service.py:157-166`:

```python
if StudioSettings().use_runtime_facade:
    try:
        await self._runtime_exec.execute_job(job, ...)  # 非阻塞，返回 None
        return None
    except Exception as e:
        await self.job_repo.set_failed(job_id, str(e))  # 仅启动阶段异常
        raise
```

**关键点**: Runtime Facade 路径下，`execute_job` 只负责启动，Job 状态的后续转换由 `_consume_run` 异步完成。

---

## 5. Runtime Facade 路径的详细状态流转

### 5.1 启动阶段

`services/article_runtime_execution_service.py:15-41`:

```python
async def execute_job(self, job: dict[str, Any], *, prompt_build) -> dict[str, Any]:
    # 创建/获取 session，绑定到 job
    session = await self.facade.create_or_get_session(create_req, user_id)
    
    # 启动异步 run
    await self.facade.start_run(session.session_id, start_req)
    
    return {"jobId": str(job["_id"]), "sessionId": session.session_id, "status": "started"}
```

`domain/runtime/services/runtime_facade_service.py:82-109`:

```python
async def start_run(self, session_id, request):
    # ★ Session: idle → streaming
    await self.session_service.mark_streaming(session_id)
    
    # 保存 run_start 事件
    await self.event_service.save_portal_event(session, {
        "event_type": "run_start",
        ...
    })
    
    # 异步启动消费协程
    asyncio.create_task(self._consume_run(session_id, request.message, rc))
    
    return StartRuntimeRunResponse(..., status="streaming")
```

**注意**: `start_run` 只更新了 **Session** 状态为 `streaming`，**Job 状态此时仍为 `running`**（由 Worker 的 `set_running` 设置）。

---

### 5.2 消费阶段 — `_consume_run`

`domain/runtime/services/runtime_facade_service.py:111-159`:

```python
async def _consume_run(self, session_id, message, request_context):
    try:
        async for frame in self.adapter.start_run_stream(...):
            parsed = self.mapper.parse_sse_frame(...)
            for item in parsed_items:
                await self.event_service.save_portal_event(session, portal_event)

                # ★ 事件: interrupt → Session=waiting_human, Job=waiting_human
                if portal_event["event_type"] == RUNTIME_EVENT_INTERRUPT:
                    await self.session_service.mark_waiting_human(session_id, ...)
                    if session.get("ownerType") == OWNER_TYPE_JOB:
                        await self.session_service.job_repo.set_waiting_human(session["ownerId"])
                    return

                # ★ 事件: run_end → Session=completed, Job=succeeded
                if portal_event["event_type"] == RUNTIME_EVENT_RUN_END:
                    await self.session_service.mark_completed(session_id)
                    mat = await self.result_service.materialize_latest_result(session_id)
                    if mat and session.get("ownerType") == OWNER_TYPE_JOB:
                        await self.result_service.persist_job_success_document(
                            session_id, job_id=session["ownerId"], result=mat
                        )
                    return
    except Exception as e:
        # ★ 异常 → Session=failed, Job=failed
        await self.session_service.mark_failed(session_id, str(e))
        if session.get("ownerType") == OWNER_TYPE_JOB:
            await self.session_service.job_repo.set_failed(session["ownerId"], str(e))
```

---

### 5.3 `persist_job_success_document` — run_end 后 Job 标记成功

`domain/runtime/services/runtime_result_service.py:125-151`:

```python
async def persist_job_success_document(self, session_id, *, job_id, result):
    job = await self.job_repo.find_by_id(job_id)
    
    # 从物化结果创建 article_documents
    doc_id = await self.document_repo.create_from_runtime_result(
        job_id=job_id,
        template_id=template_id,
        title=result.get("title") or "未命名文档",
        content_markdown=result.get("content") or "",
        ...
    )
    
    # ★ Job: running → succeeded
    await self.job_repo.set_succeeded(job_id, doc_id)
    return doc_id
```

---

## 6. Session 状态标记方法

**文件**: `domain/runtime/services/runtime_session_service.py:150-193`

| 方法 | Session 状态 | 额外字段 |
|---|---|---|
| `mark_streaming` | `"streaming"` | `runtimeStatus.streaming=True, phase="running"` |
| `mark_waiting_human` | `"waiting_human"` | `runtimeStatus.waitingHuman=True, streaming=False` + `currentInterrupt` |
| `mark_completed` | `"completed"` | `runtimeStatus.completed=True, streaming=False, waitingHuman=False` |
| `mark_failed` | `"failed"` | `runtimeStatus.failed=True, streaming=False, lastError=detail` |

```python
async def mark_streaming(self, session_id: str) -> None:
    await self.session_repo.update_status(
        session_id, "streaming",
        extra={"runtimeStatus.streaming": True, "runtimeStatus.phase": "running"},
    )

async def mark_waiting_human(self, session_id: str, *, interrupt_snapshot: dict) -> None:
    await self.session_repo.update_status(
        session_id, "waiting_human",
        current_interrupt=interrupt_snapshot,
        extra={"runtimeStatus.waitingHuman": True, "runtimeStatus.streaming": False},
    )

async def mark_completed(self, session_id: str) -> None:
    await self.session_repo.update_status(
        session_id, "completed",
        current_interrupt=None,
        extra={
            "runtimeStatus.completed": True,
            "runtimeStatus.streaming": False,
            "runtimeStatus.waitingHuman": False,
        },
    )

async def mark_failed(self, session_id: str, detail: str | None = None) -> None:
    await self.session_repo.update_status(
        session_id, "failed",
        extra={"runtimeStatus.failed": True, "runtimeStatus.streaming": False, "lastError": detail},
    )
```

---

## 7. Session 与 Job 状态同步机制

### 7.1 绑定机制

`domain/runtime/services/runtime_session_service.py:101-117`:

```python
async def _bind_session_to_owner(self, *, session_id, owner_type, owner_id, status):
    if owner_type == OWNER_TYPE_JOB:
        await self.job_repo.patch_runtime_binding(
            owner_id,
            runtime_session_id=session_id,
            runtime_provider=RUNTIME_PROVIDER_DEERFLOW,
            runtime_status=status,
        )
    else:
        await self.document_repo.append_runtime_session(owner_id, session_id)
```

当 `ownerType == "job"` 时，通过 `job_repo.patch_runtime_binding()` 将 session 绑定到 job，写入 `runtimeSessionId`、`runtimeProvider`、`runtimeStatus`。

### 7.2 同步规则总结

| Session 状态变化 | Job 状态变化 | 触发条件 |
|---|---|---|
| `idle` → `streaming` | **不变** (仍为 `running`) | `start_run` 被调用 |
| `streaming` → `waiting_human` | `running` → `waiting_human` | 收到 `interrupt` 事件 |
| `streaming` → `completed` | `running` → `succeeded` | 收到 `run_end` 事件 + 物化成功 |
| `streaming` → `failed` | `running` → `failed` | `_consume_run` 异常 |

### 7.3 关键发现

1. **`start_run` 时 Job 状态不随 Session 同步** — Session 变为 `streaming`，但 Job 保持 `running`。这是合理的，因为 Job 已经在 Worker 拾取时被标记为 `running`。

2. **`run_end` 事件后 Job 状态确实被更新** — 通过 `persist_job_success_document` → `job_repo.set_succeeded()`，Job 从 `running` 变为 `succeeded`。

3. **`interrupt` 事件后 Job 也被同步更新** — 通过 `job_repo.set_waiting_human()`，Job 从 `running` 变为 `waiting_human`。

4. **异常时双向同步** — Session 和 Job 都被标记为 `failed`。

5. **潜在不一致场景**: 如果 `run_end` 事件到达但 `materialize_latest_result` 返回 `None`（物化失败），Session 会被标记为 `completed`，但 Job **不会**被标记为 `succeeded`（因为 `if mat and ...` 条件不满足）。此时 Session=`completed` 而 Job 仍为 `running`，形成状态不一致。

---

## 8. 完整状态流转图

```
[创建 Job]
    │
    ▼
  queued ◄─── find_queued_jobs (Worker 轮询)
    │
    │  set_running()
    ▼
  running ──────────────────────────────────────────┐
    │                                                │
    ├─ [传统模式] strategy.execute()                 │
    │     │                                          │
    │     ├─ 成功 → set_succeeded() → succeeded      │
    │     └─ 异常 → set_failed()   → failed         │
    │                                                │
    ├─ [Runtime Facade 模式]                         │
    │     │                                          │
    │     ├─ start_run()                             │
    │     │   Session: idle → streaming              │
    │     │   Job: 仍为 running                      │
    │     │                                          │
    │     ├─ _consume_run() 异步消费                  │
    │     │   │                                      │
    │     │   ├─ interrupt 事件                      │
    │     │   │   Session → waiting_human            │
    │     │   │   Job    → waiting_human             │
    │     │   │                                      │
    │     │   ├─ run_end 事件                        │
    │     │   │   Session → completed                │
    │     │   │   materialize → persist_job_success  │
    │     │   │   Job    → succeeded                 │
    │     │   │                                      │
    │     │   └─ 异常                                │
    │     │       Session → failed                   │
    │     │       Job    → failed                    │
    │     │                                          │
    │     └─ 启动阶段异常 → set_failed() → failed    │
    │                                                │
    ▼                                                │
  cancelled (仅 queued 状态可取消)                    │
                                                     │
  waiting_human ── [HITL resume] ─→ 重新回到 running ┘
```

---

## 9. JobRepository 状态更新方法汇总

**文件**: `repositories/job_repository.py`

| 方法 | 状态转换 | 说明 |
|---|---|---|
| `create()` | → `queued` | 创建时自动设置 |
| `set_running(job_id)` | `queued` → `running` | Worker 拾取时调用 |
| `set_succeeded(job_id, document_id)` | `running` → `succeeded` | 成功完成 |
| `set_failed(job_id, error)` | `*` → `failed` | 失败 |
| `set_waiting_human(job_id)` | `running` → `waiting_human` | HITL 中断 |
| `cancel(job_id)` | `queued` → `cancelled` | 仅排队中可取消 |
| `update_status(job_id, status, extra_data)` | 通用状态更新 | 底层方法 |

---

## 10. 相关事件类型

**文件**: `models/persistence/runtime_constants.py`

| 事件类型 | 常量 | 触发时机 |
|---|---|---|
| `run_start` | `RUNTIME_EVENT_RUN_START` | Run 启动时 |
| `interrupt` | `RUNTIME_EVENT_INTERRUPT` | HITL 中断 |
| `run_end` | `RUNTIME_EVENT_RUN_END` | Run 正常结束 |
| `error` | `RUNTIME_EVENT_ERROR` | 错误事件 |
| `message_delta` | `RUNTIME_EVENT_MESSAGE_DELTA` | 消息增量 |
| `message_final` | `RUNTIME_EVENT_MESSAGE_FINAL` | 最终消息 |
| `tool_call` | `RUNTIME_EVENT_TOOL_CALL` | 工具调用 |
| `tool_result` | `RUNTIME_EVENT_TOOL_RESULT` | 工具结果 |
| `value_snapshot` | `RUNTIME_EVENT_VALUE_SNAPSHOT` | 状态快照 |

---

## 11. 已知问题：Thread 完成但 Job 仍为 running

### 11.1 问题描述

**现象**: Thread 已在 DeerFlow 完成并输出文档，但 Job 状态仍为 `running`。

**验证信息**:
- Job ID: `69e6ebf92a95e3d809744386`
- Thread ID: `7a23b133-ecd4-43ee-bb55-6bc376cc4f77`

### 11.2 根因分析

**核心问题在 `runtime_facade_service.py:144-153`**:

```python
if portal_event["event_type"] == RUNTIME_EVENT_RUN_END:
    await self.session_service.mark_completed(session_id)  # ✅ Session 更新为 completed
    mat = await self.result_service.materialize_latest_result(session_id)  # ⚠️ 物化结果
    if mat and session.get("ownerType") == OWNER_TYPE_JOB:  # ❌ 只有 mat 非空才更新 Job
        await self.result_service.persist_job_success_document(...)
    return
```

**物化失败的条件** (`RuntimeResultMapper.from_thread_state`):

```python
def from_thread_state(self, state: dict[str, Any]) -> dict[str, Any] | None:
    values = state.get("values") or {}
    messages = values.get("messages") or state.get("messages")
    content: str | None = None
    if messages:
        content = self._last_ai_text(messages)
    if not content:
        return None  # ❌ 当没有 AI 消息内容时返回 None
    ...
```

**可能的原因**:

1. **DeerFlow agent 输出格式不匹配**: `_last_ai_text` 期望消息格式为 `{type: "ai", content: "..."}` 或 `{role: "assistant", content: "..."}`，但实际格式可能不同
2. **Thread state 结构变化**: `state.values.messages` 路径不存在，或消息列表为空
3. **结果存储在其他字段**: 如 `artifacts`、`output` 等，但 mapper 未处理

### 11.3 状态不一致后果

| 组件 | 状态 | 说明 |
|------|------|------|
| Thread (DeerFlow) | 已完成 | 输出了文档 |
| Session | `completed` | `mark_completed` 已执行 |
| Job | `running` | **未更新**，因为 `mat is None` |

### 11.4 修复方案（已实现）

#### 修复 1：`end` 事件解析

**文件**: `domain/runtime/mappers/deerflow_event_mapper.py`

**问题**: DeerFlow Gateway 发送 `event: end\ndata: null\n\n`，但原代码只在 `data: [DONE]` 时才识别为 `run_end`。

**修复**: 在 `parse_sse_frame` 中增加对 `sse_event == "end"` 的直接处理：

```python
# 特殊处理：sse_event == "end" 时，无论 data 内容如何，都返回 run_end
# DeerFlow Gateway 发送格式: event: end\ndata: null\n\n
if sse_event == "end":
    return {"sse_event": "end", "event_type": RUNTIME_EVENT_RUN_END, "source": "system", "payload": {}}
```

#### 修复 2：SSE 流结束兜底处理

**文件**: `domain/runtime/services/runtime_facade_service.py`

**问题**: 当 SSE 流正常结束但未收到 `run_end` 事件时，Session 和 Job 状态不会被更新。

**修复**:
1. 增加 `run_end_received` 标志追踪是否收到 `run_end` 事件
2. SSE 流结束后检查，若未收到 `run_end` 且 Session 仍为 `streaming`，触发兜底完成流程
3. 新增 `_handle_run_completion` 方法统一处理完成逻辑
4. 物化失败时也标记 Job 成功（无文档关联）

```python
async def _consume_run(self, session_id: str, message: str, request_context: dict[str, Any]) -> None:
    run_end_received = False  # 追踪是否收到 run_end 事件

    try:
        async for frame in self.adapter.start_run_stream(...):
            # ... 处理事件
            if portal_event["event_type"] == RUNTIME_EVENT_RUN_END:
                run_end_received = True
                await self._handle_run_completion(session_id, session)
                return

        # SSE 流正常结束但未收到 run_end 事件 — 兜底处理
        if not run_end_received:
            logger.warning("SSE stream ended without run_end event for session %s", session_id)
            session = await self.session_service.get_by_id(session_id)
            if session and session.get("status") == "streaming":
                await self._handle_run_completion(session_id, session)

    except Exception as e:
        # ... 异常处理

async def _handle_run_completion(self, session_id: str, session: dict) -> None:
    """处理 run 完成（无论是收到 run_end 还是 SSE 流结束的兜底）"""
    await self.session_service.mark_completed(session_id)
    mat = await self.result_service.materialize_latest_result(session_id)
    if session.get("ownerType") == OWNER_TYPE_JOB:
        if mat:
            await self.result_service.persist_job_success_document(...)
        else:
            # 物化失败也标记 Job 成功（无文档关联）
            await self.session_service.job_repo.set_succeeded(session["ownerId"], None)
```

### 11.5 验证步骤

对于提供的 Job ID 和 Thread ID:

1. **查询 MongoDB 中的 Job 状态**:
   ```javascript
   db.portal_jobs.findOne({_id: ObjectId("69e6ebf92a95e3d809744386")}, {status: 1, runtimeSessionId: 1})
   ```

2. **查询 Session 状态**:
   ```javascript
   db.portal_runtime_sessions.findOne({threadId: "7a23b133-ecd4-43ee-bb55-6bc376cc4f77"}, {status: 1, materializedResult: 1})
   ```

3. **调用 DeerFlow Gateway 获取 thread state**:
   ```bash
   curl http://<deerflow-gateway>/api/threads/7a23b133-ecd4-43ee-bb55-6bc376cc4f77/state
   ```

4. **检查事件日志**:
   ```javascript
   db.portal_runtime_events.find({sessionId: <session_id>}).sort({seq: -1}).limit(10)
   ```

---

## 12. Session Recovery Worker（状态恢复机制）

### 12.1 问题背景

当 SSE 流异常断开时，可能导致：
- Session 状态仍为 `streaming`，但 DeerFlow thread 已完成
- Job 状态仍为 `running`，但实际执行已结束
- 用户无法看到最终结果

### 12.2 解决方案

新增 `SessionRecoveryWorker`，定期检查卡住的 session 并同步状态。

**文件**: `workers/session_recovery_worker.py`

### 12.3 工作原理

```
SessionRecoveryWorker
    │
    ├─ 定期轮询（默认 6 秒）
    │
    ├─ 查询卡住的 session
    │   └─ status=streaming 且 updatedAt 超过 5 分钟
    │
    ├─ 调用 DeerFlow API 获取 thread 状态
    │   └─ GET /api/threads/{thread_id}/state
    │
    └─ 根据实际状态同步修复
        ├─ thread completed → Session=completed, Job=succeeded
        ├─ thread interrupted → Session=waiting_human, Job=waiting_human
        ├─ thread error → Session=failed, Job=failed
        └─ thread running → 更新 updatedAt（防止重复检查）
```

### 12.4 Thread 状态判断逻辑

```python
def _determine_thread_status(self, state: dict) -> str:
    # 检查是否有 interrupt
    tasks = state.get("tasks") or []
    for task in tasks:
        if task.get("interrupts"):
            return "interrupted"

    # 检查 next 列表
    next_nodes = state.get("next") or []
    if not next_nodes:
        return "completed"  # next 为空表示执行完成

    # 检查 checkpoint 中的错误
    checkpoint = state.get("checkpoint") or {}
    if checkpoint.get("error"):
        return "error"

    return "running"
```

### 12.5 启动方式

**方式 1：独立进程**
```bash
cd backend
python -m studio.workers.run_session_recovery_worker
```

**方式 2：嵌入 FastAPI lifespan**

在 `api/app.py` 的 lifespan 中添加：
```python
from studio.workers import SessionRecoveryWorker

async def lifespan(app: FastAPI):
    recovery_worker = SessionRecoveryWorker()
    asyncio.create_task(recovery_worker.start())
    yield
    recovery_worker.stop()
```

### 12.6 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `poll_seconds` | 6.0 | 轮询间隔（秒） |
| `stuck_timeout_seconds` | 300 | 判定卡住的超时时间（秒） |
| `batch_size` | 10 | 每次处理的最大 session 数量 |

### 12.7 新增 Repository 方法

**文件**: `repositories/runtime_session_repository.py`

```python
async def find_by_status(self, status: str, limit: int = 100) -> list[dict]:
    """查询指定状态的所有 session"""

async def find_stuck_sessions(
    self,
    status: str = "streaming",
    timeout_seconds: int = 300,
    limit: int = 100,
) -> list[dict]:
    """查询卡住的 session（状态为 streaming 但超过指定时间未更新）"""

async def find_by_owner_type(
    self,
    owner_type: str,
    status: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """按 owner 类型查询 session"""
```
