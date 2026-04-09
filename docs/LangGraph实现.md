# DeerFlow LangGraph 实现文档

## 一、LangGraph 概述

LangGraph 是 LangChain 生态系统中的状态机框架，用于构建有状态的、多角色的 AI 应用。DeerFlow 基于 LangGraph 构建了完整的 Agent 系统，充分利用其状态管理、检查点和中间件机制。

### 1.1 LangGraph 核心概念

| 概念 | 说明 | DeerFlow 应用 |
|------|------|--------------|
| **StateGraph** | 状态图，定义节点和边 | Agent 状态流转 |
| **State** | 状态对象，在节点间传递 | ThreadState |
| **Node** | 处理节点，执行具体逻辑 | 模型调用、工具执行 |
| **Edge** | 边，定义节点间的转换 | 条件分支、循环 |
| **Checkpointer** | 检查点，持久化状态 | 会话持久化 |
| **Middleware** | 中间件，拦截和处理 | 功能扩展机制 |

### 1.2 DeerFlow 中的 LangGraph 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     LangGraph Runtime                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              StateGraph (Lead Agent)                   │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐             │  │
│  │  │  Start  │→│  Agent   │→│   End   │             │  │
│  │  └─────────┘  └──────────┘  └─────────┘             │  │
│  │                     ↓↑                                │  │
│  │               ┌──────────┐                           │  │
│  │               │  Tools   │                           │  │
│  │               └──────────┘                           │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Middleware Chain                          │  │
│  │  [ThreadData]→[Sandbox]→[Memory]→[Loop]→[Clarify]    │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Checkpointer                              │  │
│  │  [Memory] / [SQLite] / [Postgres]                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 二、Agent 创建与配置

### 2.1 langgraph.json 配置

**文件**: [langgraph.json](file:///d:/git_ai/deer-flow/backend/langgraph.json)

```json
{
  "$schema": "https://langgra.ph/schema.json",
  "python_version": "3.12",
  "dependencies": ["."],
  "env": ".env",
  "graphs": {
    "lead_agent": "deerflow.agents:make_lead_agent"
  },
  "checkpointer": {
    "path": "./packages/harness/deerflow/agents/checkpointer/async_provider.py:make_checkpointer"
  }
}
```

**配置说明**:

| 字段 | 说明 |
|------|------|
| `python_version` | Python 版本要求 |
| `dependencies` | 项目依赖 |
| `env` | 环境变量文件 |
| `graphs` | 图定义，键为图名称，值为工厂函数路径 |
| `checkpointer` | 检查点提供者路径 |

### 2.2 Agent 工厂函数

**文件**: [agent.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/agents/lead_agent/agent.py)

**入口函数**: `make_lead_agent`

```python
def make_lead_agent(config: RunnableConfig):
    """
    LangGraph 入口点，创建主 Agent
    
    Args:
        config: 运行时配置，包含：
            - thinking_enabled: 是否启用思考模式
            - model_name: 模型名称
            - is_plan_mode: 是否启用计划模式
            - subagent_enabled: 是否启用子 Agent
            - agent_name: Agent 名称
    
    Returns:
        CompiledStateGraph: 编译后的状态图
    """
```

**创建流程**:

```
配置解析 → 模型创建 → 中间件构建 → 工具加载 → 提示词生成 → Agent 编译
```

### 2.3 create_agent 调用

DeerFlow 使用 LangChain 的 `create_agent` 函数创建 Agent：

```python
from langchain.agents import create_agent

agent = create_agent(
    model=create_chat_model(name=model_name, thinking_enabled=thinking_enabled),
    tools=get_available_tools(model_name=model_name, subagent_enabled=subagent_enabled),
    middleware=_build_middlewares(config, model_name=model_name, agent_name=agent_name),
    system_prompt=apply_prompt_template(subagent_enabled=subagent_enabled, agent_name=agent_name),
    state_schema=ThreadState,
    checkpointer=checkpointer,
    name=agent_name or "default",
)
```

**参数说明**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | BaseChatModel | LLM 模型实例 |
| `tools` | list[BaseTool] | 可用工具列表 |
| `middleware` | list[AgentMiddleware] | 中间件链 |
| `system_prompt` | str | 系统提示词 |
| `state_schema` | type | 状态模式类 |
| `checkpointer` | BaseCheckpointSaver | 检查点保存器 |
| `name` | str | Agent 名称 |

## 三、状态管理

### 3.1 ThreadState 定义

**文件**: [thread_state.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/agents/thread_state.py)

```python
from typing import Annotated, NotRequired, TypedDict
from langchain.agents import AgentState

class ThreadState(AgentState):
    """线程状态，继承自 LangChain 的 AgentState"""
    
    # 沙箱状态
    sandbox: NotRequired[SandboxState | None]
    
    # 线程数据
    thread_data: NotRequired[ThreadDataState | None]
    
    # 会话标题
    title: NotRequired[str | None]
    
    # 制品列表（使用 reducer 合并）
    artifacts: Annotated[list[str], merge_artifacts]
    
    # 任务列表
    todos: NotRequired[list | None]
    
    # 上传的文件
    uploaded_files: NotRequired[list[dict] | None]
    
    # 查看的图片（使用 reducer 合并）
    viewed_images: Annotated[dict[str, ViewedImageData], merge_viewed_images]
```

### 3.2 Reducer 函数

LangGraph 使用 reducer 函数来合并状态更新：

#### merge_artifacts

```python
def merge_artifacts(existing: list[str] | None, new: list[str] | None) -> list[str]:
    """合并并去重制品列表"""
    if existing is None:
        return new or []
    if new is None:
        return existing
    # 使用 dict.fromkeys 去重并保持顺序
    return list(dict.fromkeys(existing + new))
```

#### merge_viewed_images

```python
def merge_viewed_images(
    existing: dict[str, ViewedImageData] | None,
    new: dict[str, ViewedImageData] | None
) -> dict[str, ViewedImageData]:
    """合并图片字典
    
    特殊情况：如果 new 是空字典 {}，则清空现有图片
    """
    if existing is None:
        return new or {}
    if new is None:
        return existing
    # 空字典表示清空
    if len(new) == 0:
        return {}
    # 合并字典，新值覆盖旧值
    return {**existing, **new}
```

### 3.3 状态流转

```
初始状态
    ↓
ThreadDataMiddleware (添加 thread_data)
    ↓
SandboxMiddleware (添加 sandbox)
    ↓
UploadsMiddleware (添加 uploaded_files)
    ↓
[模型调用]
    ↓
[工具执行] (更新 artifacts, viewed_images)
    ↓
TitleMiddleware (添加 title)
    ↓
MemoryMiddleware (读取 messages)
    ↓
最终状态
```

## 四、中间件系统

### 4.1 中间件架构

DeerFlow 的中间件系统基于 LangGraph 的中间件机制，提供了强大的扩展能力。

**中间件基类**:

```python
from langchain.agents.middleware import AgentMiddleware

class AgentMiddleware(Generic[StateT]):
    """中间件基类"""
    
    # 钩子方法
    def before_agent(self, state: StateT, runtime: Runtime) -> dict | None:
        """Agent 执行前"""
        pass
    
    def after_agent(self, state: StateT, runtime: Runtime) -> dict | None:
        """Agent 执行后"""
        pass
    
    def before_model(self, state: StateT, runtime: Runtime) -> dict | None:
        """模型调用前"""
        pass
    
    def after_model(self, state: StateT, runtime: Runtime) -> dict | None:
        """模型调用后"""
        pass
    
    def before_tool(self, state: StateT, runtime: Runtime) -> dict | None:
        """工具执行前"""
        pass
    
    def after_tool(self, state: StateT, runtime: Runtime) -> dict | None:
        """工具执行后"""
        pass
```

### 4.2 中间件执行流程

```
用户消息
    ↓
[before_agent 钩子]
    ↓
[before_model 钩子]
    ↓
模型调用 (LLM)
    ↓
[after_model 钩子]
    ↓
工具调用？
    ├─ 是 → [before_tool 钩子]
    │         ↓
    │       工具执行
    │         ↓
    │       [after_tool 钩子]
    │         ↓
    │       返回模型调用
    │
    └─ 否 → [after_agent 钩子]
              ↓
            返回响应
```

### 4.3 关键中间件实现

#### LoopDetectionMiddleware

**文件**: [loop_detection_middleware.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/agents/middlewares/loop_detection_middleware.py)

**实现原理**:

```python
class LoopDetectionMiddleware(AgentMiddleware[AgentState]):
    """循环检测中间件"""
    
    def after_model(self, state: AgentState, runtime: Runtime) -> dict | None:
        """在模型调用后检测循环"""
        # 1. 获取最后的 AI 消息
        messages = state.get("messages", [])
        last_msg = messages[-1]
        
        if last_msg.type != "ai":
            return None
        
        tool_calls = last_msg.tool_calls
        if not tool_calls:
            return None
        
        # 2. 计算工具调用哈希
        call_hash = self._hash_tool_calls(tool_calls)
        
        # 3. 更新历史并检查
        thread_id = self._get_thread_id(runtime)
        count = self._update_history(thread_id, call_hash)
        
        # 4. 判断是否需要干预
        if count >= self.hard_limit:
            # 强制移除工具调用
            return self._force_stop(last_msg)
        
        if count >= self.warn_threshold:
            # 注入警告消息
            return self._inject_warning()
        
        return None
```

**关键算法**:

```python
def _hash_tool_calls(self, tool_calls: list[dict]) -> str:
    """生成工具调用的确定性哈希
    
    特点：
    - 顺序无关：相同工具调用集合产生相同哈希
    - 确定性：相同输入总是产生相同输出
    """
    normalized = [
        {"name": tc["name"], "args": tc["args"]}
        for tc in tool_calls
    ]
    
    # 排序以确保顺序无关
    normalized.sort(key=lambda tc: (
        tc["name"],
        json.dumps(tc["args"], sort_keys=True)
    ))
    
    blob = json.dumps(normalized, sort_keys=True)
    return hashlib.md5(blob.encode()).hexdigest()[:12]
```

#### MemoryMiddleware

**文件**: [memory_middleware.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/agents/middlewares/memory_middleware.py)

**实现原理**:

```python
class MemoryMiddleware(AgentMiddleware[MemoryMiddlewareState]):
    """内存管理中间件"""
    
    def after_agent(self, state: MemoryMiddlewareState, runtime: Runtime) -> dict | None:
        """在 Agent 完成后队列内存更新"""
        # 1. 检查是否启用
        config = get_memory_config()
        if not config.enabled:
            return None
        
        # 2. 获取线程 ID
        thread_id = runtime.context.get("thread_id")
        if not thread_id:
            return None
        
        # 3. 过滤消息
        messages = state.get("messages", [])
        filtered_messages = _filter_messages_for_memory(messages)
        
        # 4. 检测纠正
        correction_detected = detect_correction(filtered_messages)
        
        # 5. 加入更新队列
        queue = get_memory_queue()
        queue.add(
            thread_id=thread_id,
            messages=filtered_messages,
            agent_name=self._agent_name,
            correction_detected=correction_detected
        )
        
        return None
```

**消息过滤算法**:

```python
def _filter_messages_for_memory(messages: list[Any]) -> list[Any]:
    """过滤消息，只保留用户输入和最终响应
    
    过滤规则：
    - 保留 HumanMessage（移除上传文件标签）
    - 保留 AIMessage（无 tool_calls）
    - 移除 ToolMessage
    - 移除 AI 消息中的工具调用
    """
    filtered = []
    skip_next_ai = False
    
    for msg in messages:
        if msg.type == "human":
            content = _extract_message_text(msg)
            
            # 移除上传文件标签
            if "<uploaded_files>" in content:
                stripped = _UPLOAD_BLOCK_RE.sub("", content).strip()
                if not stripped:
                    skip_next_ai = True
                    continue
                
                # 重建消息
                clean_msg = copy(msg)
                clean_msg.content = stripped
                filtered.append(clean_msg)
            else:
                filtered.append(msg)
                skip_next_ai = False
        
        elif msg.type == "ai":
            if not msg.tool_calls and not skip_next_ai:
                filtered.append(msg)
            skip_next_ai = False
    
    return filtered
```

#### ClarificationMiddleware

**文件**: [clarification_middleware.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/agents/middlewares/clarification_middleware.py)

**功能**: 拦截澄清请求，转换为工具调用

**实现**:

```python
class ClarificationMiddleware(AgentMiddleware[AgentState]):
    """澄清中间件"""
    
    def after_model(self, state: AgentState, runtime: Runtime) -> dict | None:
        """检测并处理澄清请求"""
        messages = state.get("messages", [])
        last_msg = messages[-1]
        
        if last_msg.type != "ai":
            return None
        
        # 检测澄清请求
        if self._is_clarification_request(last_msg.content):
            # 转换为工具调用
            tool_call = {
                "name": "ask_clarification",
                "args": {"question": last_msg.content},
                "id": str(uuid.uuid4())
            }
            
            # 更新消息
            updated_msg = last_msg.model_copy(update={
                "tool_calls": [tool_call]
            })
            
            return {"messages": [updated_msg]}
        
        return None
```

### 4.4 中间件链构建

**文件**: [factory.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/agents/factory.py)

**构建算法**:

```python
def _assemble_from_features(
    feat: RuntimeFeatures,
    *,
    name: str = "default",
    plan_mode: bool = False,
    extra_middleware: list[AgentMiddleware] | None = None,
) -> tuple[list[AgentMiddleware], list[BaseTool]]:
    """从特性构建中间件链"""
    
    chain: list[AgentMiddleware] = []
    extra_tools: list[BaseTool] = []
    
    # 1. 沙箱基础设施
    if feat.sandbox is not False:
        if isinstance(feat.sandbox, AgentMiddleware):
            chain.append(feat.sandbox)
        else:
            chain.append(ThreadDataMiddleware(lazy_init=True))
            chain.append(UploadsMiddleware())
            chain.append(SandboxMiddleware(lazy_init=True))
    
    # 2. 悬空工具调用修复
    chain.append(DanglingToolCallMiddleware())
    
    # 3. 护栏
    if feat.guardrail is not False:
        chain.append(feat.guardrail if isinstance(feat.guardrail, AgentMiddleware)
                     else _create_default_guardrail())
    
    # 4. 工具错误处理
    chain.append(ToolErrorHandlingMiddleware())
    
    # 5. 摘要
    if feat.summarization is not False:
        chain.append(feat.summarization if isinstance(feat.summarization, AgentMiddleware)
                     else _create_default_summarization())
    
    # 6. Todo 列表
    if plan_mode:
        chain.append(TodoMiddleware(...))
    
    # 7. 标题生成
    if feat.auto_title is not False:
        chain.append(TitleMiddleware())
    
    # 8. 内存
    if feat.memory is not False:
        chain.append(MemoryMiddleware(agent_name=name))
    
    # 9. 视觉
    if feat.vision is not False:
        chain.append(ViewImageMiddleware())
        extra_tools.append(view_image_tool)
    
    # 10. 子 Agent
    if feat.subagent is not False:
        chain.append(SubagentLimitMiddleware())
        extra_tools.append(task_tool)
    
    # 11. 循环检测
    chain.append(LoopDetectionMiddleware())
    
    # 12. 澄清（始终最后）
    chain.append(ClarificationMiddleware())
    extra_tools.append(ask_clarification_tool)
    
    # 13. 插入额外中间件
    if extra_middleware:
        _insert_extra(chain, extra_middleware)
    
    return chain, extra_tools
```

## 五、检查点系统

### 5.1 Checkpointer 概念

LangGraph 的 Checkpointer 提供状态持久化能力，支持：
- 会话恢复
- 状态回滚
- 时间旅行调试

### 5.2 Checkpointer 实现

**文件**: [async_provider.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/agents/checkpointer/async_provider.py)

**工厂函数**:

```python
@contextlib.asynccontextmanager
async def make_checkpointer() -> AsyncIterator[Checkpointer]:
    """创建检查点保存器
    
    根据配置返回不同后端：
    - memory: 内存存储
    - sqlite: SQLite 数据库
    - postgres: PostgreSQL 数据库
    """
    config = get_app_config()
    
    # 无配置时使用内存存储
    if config.checkpointer is None:
        yield InMemorySaver()
        return
    
    # 根据类型创建
    async with _async_checkpointer(config.checkpointer) as saver:
        yield saver
```

**SQLite 实现**:

```python
@contextlib.asynccontextmanager
async def _async_checkpointer(config) -> AsyncIterator[Checkpointer]:
    if config.type == "sqlite":
        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
        
        # 解析连接字符串
        conn_str = resolve_sqlite_conn_str(config.connection_string or "store.db")
        
        # 确保父目录存在
        ensure_sqlite_parent_dir(conn_str)
        
        # 创建保存器
        async with AsyncSqliteSaver.from_conn_string(conn_str) as saver:
            # 初始化表结构
            await saver.setup()
            yield saver
```

**Postgres 实现**:

```python
if config.type == "postgres":
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    
    if not config.connection_string:
        raise ValueError("PostgreSQL connection string required")
    
    async with AsyncPostgresSaver.from_conn_string(
        config.connection_string
    ) as saver:
        await saver.setup()
        yield saver
```

### 5.3 检查点使用

**在 Agent 创建时注入**:

```python
agent = create_agent(
    model=model,
    tools=tools,
    middleware=middlewares,
    checkpointer=checkpointer,  # 注入检查点
    state_schema=ThreadState,
)
```

**在调用时指定线程 ID**:

```python
config = RunnableConfig(
    configurable={"thread_id": "user-123-session-456"}
)

result = agent.invoke(
    {"messages": [HumanMessage(content="Hello")]},
    config=config
)
```

**状态恢复**:

```python
# 恢复之前的会话
result = agent.invoke(
    {"messages": [HumanMessage(content="Continue")]},
    config={"configurable": {"thread_id": "user-123-session-456"}}
)
```

## 六、运行时管理

### 6.1 Run Manager

**文件**: [manager.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/runtime/runs/manager.py)

**核心功能**:
- 运行实例管理
- 状态跟踪
- 取消和中断
- 多任务策略

**运行状态**:

```python
class RunStatus(str, Enum):
    pending = "pending"        # 待执行
    running = "running"        # 执行中
    success = "success"        # 成功
    error = "error"            # 错误
    interrupted = "interrupted"  # 已中断
    cancelled = "cancelled"    # 已取消
```

**运行记录**:

```python
@dataclass
class RunRecord:
    run_id: str
    thread_id: str
    assistant_id: str | None
    status: RunStatus
    on_disconnect: DisconnectMode
    multitask_strategy: str = "reject"
    metadata: dict = field(default_factory=dict)
    kwargs: dict = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""
    task: asyncio.Task | None = field(default=None)
    abort_event: asyncio.Event = field(default_factory=asyncio.Event)
    abort_action: str = "interrupt"
    error: str | None = None
```

**多任务策略**:

```python
async def create_or_reject(
    self,
    thread_id: str,
    assistant_id: str | None = None,
    *,
    multitask_strategy: str = "reject",
) -> RunRecord:
    """原子创建运行，处理多任务策略"""
    
    async with self._lock:
        # 检查现有运行
        inflight = [r for r in self._runs.values()
                    if r.thread_id == thread_id
                    and r.status in (RunStatus.pending, RunStatus.running)]
        
        # 拒绝策略
        if multitask_strategy == "reject" and inflight:
            raise ConflictError(f"Thread {thread_id} already has active run")
        
        # 中断策略
        if multitask_strategy == "interrupt" and inflight:
            for r in inflight:
                r.abort_action = "interrupt"
                r.abort_event.set()
                if r.task and not r.task.done():
                    r.task.cancel()
                r.status = RunStatus.interrupted
        
        # 回滚策略
        if multitask_strategy == "rollback" and inflight:
            for r in inflight:
                r.abort_action = "rollback"
                r.abort_event.set()
                if r.task and not r.task.done():
                    r.task.cancel()
                r.status = RunStatus.interrupted
        
        # 创建新运行
        record = RunRecord(...)
        self._runs[run_id] = record
        return record
```

### 6.2 Stream Bridge

**位置**: `packages/harness/deerflow/runtime/stream_bridge/`

**功能**: 桥接 LangGraph 流式输出到 HTTP SSE

**实现**:

```python
class StreamBridge:
    """流桥接器"""
    
    def __init__(self):
        self._queues: dict[str, asyncio.Queue] = {}
    
    async def publish(self, thread_id: str, event: dict):
        """发布事件"""
        if thread_id in self._queues:
            await self._queues[thread_id].put(event)
    
    async def subscribe(self, thread_id: str) -> AsyncIterator[dict]:
        """订阅事件流"""
        queue = asyncio.Queue()
        self._queues[thread_id] = queue
        
        try:
            while True:
                event = await queue.get()
                if event is None:  # 结束信号
                    break
                yield event
        finally:
            del self._queues[thread_id]
```

## 七、工具集成

### 7.1 工具系统架构

```
Tool Definition (config.yaml)
    ↓
Tool Loader (tools.py)
    ↓
Tool Resolution (reflection)
    ↓
Tool Injection (create_agent)
    ↓
Tool Execution (LangGraph)
    ↓
Tool Result (state update)
```

### 7.2 工具加载流程

**文件**: [tools.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/tools/tools.py)

```python
def get_available_tools(
    groups: list[str] | None = None,
    include_mcp: bool = True,
    model_name: str | None = None,
    subagent_enabled: bool = False,
) -> list[BaseTool]:
    """获取可用工具列表"""
    
    # 1. 从配置加载
    config = get_app_config()
    tool_configs = [tool for tool in config.tools
                    if groups is None or tool.group in groups]
    
    # 2. 安全过滤
    if not is_host_bash_allowed(config):
        tool_configs = [tool for tool in tool_configs
                        if not _is_host_bash_tool(tool)]
    
    # 3. 解析工具
    loaded_tools = [resolve_variable(tool.use, BaseTool)
                    for tool in tool_configs]
    
    # 4. 添加内置工具
    builtin_tools = [present_file_tool, ask_clarification_tool]
    
    # 5. 条件添加工具
    if subagent_enabled:
        builtin_tools.append(task_tool)
    
    if model_supports_vision(model_name):
        builtin_tools.append(view_image_tool)
    
    # 6. 加载 MCP 工具
    mcp_tools = []
    if include_mcp:
        mcp_tools = get_cached_mcp_tools()
        
        # 工具搜索延迟加载
        if config.tool_search.enabled:
            registry = DeferredToolRegistry()
            for t in mcp_tools:
                registry.register(t)
            set_deferred_registry(registry)
            builtin_tools.append(tool_search_tool)
    
    # 7. 加载 ACP 工具
    acp_tools = []
    acp_agents = get_acp_agents()
    if acp_agents:
        acp_tools.append(build_invoke_acp_agent_tool(acp_agents))
    
    return loaded_tools + builtin_tools + mcp_tools + acp_tools
```

### 7.3 MCP 工具集成

**文件**: [mcp/tools.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/mcp/tools.py)

```python
def load_mcp_tools(servers: list[MCPServerConfig]) -> list[BaseTool]:
    """加载 MCP 工具"""
    from langchain_mcp_adapters import load_mcp_tools
    
    tools = []
    for server in servers:
        # 连接 MCP 服务器
        client = MCPClient(server)
        
        # 发现工具
        server_tools = client.list_tools()
        
        # 转换为 LangChain 工具
        for tool_info in server_tools:
            tool = convert_mcp_tool(tool_info, client)
            tools.append(tool)
    
    return tools
```

## 八、流式响应

### 8.1 流式输出机制

LangGraph 支持多种流式模式：

| 模式 | 说明 | DeerFlow 使用 |
|------|------|--------------|
| `values` | 完整状态快照 | 状态更新事件 |
| `messages` | 消息增量 | 文本流式输出 |
| `updates` | 节点更新 | 节点执行事件 |
| `debug` | 调试信息 | 开发调试 |

### 8.2 客户端流式调用

**文件**: [client.py](file:///d:/git_ai/deer-flow/backend/packages/harness/deerflow/client.py)

```python
def stream(self, message: str, *, thread_id: str | None = None, **kwargs):
    """流式调用 Agent"""
    
    config = self._get_runnable_config(thread_id, **kwargs)
    self._ensure_agent(config)
    
    state = {"messages": [HumanMessage(content=message)]}
    context = {"thread_id": thread_id}
    
    seen_ids = set()
    cumulative_usage = {"input_tokens": 0, "output_tokens": 0}
    
    # 流式调用
    for chunk in self._agent.stream(
        state,
        config=config,
        context=context,
        stream_mode="values"
    ):
        messages = chunk.get("messages", [])
        
        for msg in messages:
            # 去重
            msg_id = getattr(msg, "id", None)
            if msg_id and msg_id in seen_ids:
                continue
            if msg_id:
                seen_ids.add(msg_id)
            
            # 处理 AI 消息
            if isinstance(msg, AIMessage):
                # 追踪 token 使用
                usage = getattr(msg, "usage_metadata", None)
                if usage:
                    cumulative_usage["input_tokens"] += usage.get("input_tokens", 0)
                    cumulative_usage["output_tokens"] += usage.get("output_tokens", 0)
                
                # 发送工具调用事件
                if msg.tool_calls:
                    yield StreamEvent(
                        type="messages-tuple",
                        data={
                            "type": "ai",
                            "content": "",
                            "id": msg_id,
                            "tool_calls": [...]
                        }
                    )
                
                # 发送文本事件
                if msg.content:
                    yield StreamEvent(
                        type="messages-tuple",
                        data={
                            "type": "ai",
                            "content": self._extract_text(msg.content),
                            "id": msg_id,
                            "usage_metadata": usage
                        }
                    )
            
            # 处理工具消息
            elif isinstance(msg, ToolMessage):
                yield StreamEvent(
                    type="messages-tuple",
                    data={
                        "type": "tool",
                        "content": self._extract_text(msg.content),
                        "name": getattr(msg, "name", None),
                        "tool_call_id": getattr(msg, "tool_call_id", None),
                        "id": msg_id
                    }
                )
        
        # 发送状态快照
        yield StreamEvent(
            type="values",
            data={
                "title": chunk.get("title"),
                "messages": [self._serialize_message(m) for m in messages],
                "artifacts": chunk.get("artifacts", [])
            }
        )
    
    # 发送结束事件
    yield StreamEvent(type="end", data={"usage": cumulative_usage})
```

### 8.3 HTTP SSE 流式响应

**文件**: [thread_runs.py](file:///d:/git_ai/deer-flow/backend/app/gateway/routers/thread_runs.py)

```python
@router.post("/threads/{thread_id}/runs/stream")
async def stream_run(
    thread_id: str,
    request: RunCreateRequest,
    accept: str = Header(default="application/json"),
):
    """流式运行 Agent"""
    
    if accept == "text/event-stream":
        return StreamingResponse(
            stream_run_events(thread_id, request),
            media_type="text/event-stream"
        )
    
    # 非流式响应
    return await run_and_wait(thread_id, request)

async def stream_run_events(
    thread_id: str,
    request: RunCreateRequest
) -> AsyncIterator[str]:
    """生成 SSE 事件流"""
    
    # 创建运行
    run = await run_manager.create_or_reject(
        thread_id,
        assistant_id=request.assistant_id,
        kwargs=request.input
    )
    
    # 执行 Agent
    async for event in execute_agent_stream(thread_id, request):
        # 格式化为 SSE
        yield f"event: {event.type}\n"
        yield f"data: {json.dumps(event.data)}\n\n"
    
    # 发送结束事件
    yield "event: end\n"
    yield "data: {}\n\n"
```

## 九、配置与部署

### 9.1 LangGraph 配置

**langgraph.json**:

```json
{
  "$schema": "https://langgra.ph/schema.json",
  "python_version": "3.12",
  "dependencies": ["."],
  "env": ".env",
  "graphs": {
    "lead_agent": "deerflow.agents:make_lead_agent"
  },
  "checkpointer": {
    "path": "./packages/harness/deerflow/agents/checkpointer/async_provider.py:make_checkpointer"
  }
}
```

### 9.2 运行时配置

**config.yaml**:

```yaml
models:
  - name: default
    model: gpt-4
    provider: openai
    supports_thinking: true

tools:
  - group: bash
    use: deerflow.sandbox.tools:bash_tool

checkpointer:
  type: sqlite
  connection_string: ./data/checkpoints.db

memory:
  enabled: true
  storage_path: ./data/memory
```

### 9.3 部署模式

#### 单进程模式

```bash
langgraph dev
```

#### 分布式模式

```bash
# 启动 LangGraph Server
langgraph up

# 启动 Gateway
uvicorn app.gateway.app:app --host 0.0.0.0 --port 8000
```

## 十、性能优化

### 10.1 检查点优化

- 使用 SQLite 或 Postgres 替代内存存储
- 配置合适的检查点保留策略
- 定期清理旧检查点

### 10.2 中间件优化

- 延迟初始化（`lazy_init=True`）
- 避免重复计算
- 使用缓存

### 10.3 工具优化

- MCP 工具缓存
- 延迟加载非必需工具
- 工具搜索延迟注册

### 10.4 流式优化

- 使用异步生成器
- 避免阻塞操作
- 合理设置缓冲区大小

## 十一、调试与监控

### 11.1 LangSmith 集成

```python
# 配置环境变量
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=<your-api-key>
export LANGCHAIN_PROJECT=deer-flow
```

### 11.2 日志记录

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger("deerflow")
```

### 11.3 性能监控

- Token 使用统计
- 响应时间监控
- 资源使用追踪

## 十二、最佳实践

### 12.1 Agent 设计

- 保持中间件顺序一致
- 合理配置递归限制
- 使用检查点持久化
- 避免过度使用工具

### 12.2 状态管理

- 使用 Reducer 函数合并状态
- 避免在状态中存储大量数据
- 定期清理不必要的状态

### 12.3 中间件开发

- 遵循单一职责原则
- 正确处理异步操作
- 提供清晰的错误信息
- 添加适当的日志

### 12.4 工具开发

- 提供清晰的工具描述
- 处理异常情况
- 限制输出大小
- 使用类型注解

## 十三、常见问题

### 13.1 状态丢失

**问题**: 会话状态丢失

**解决方案**:
- 配置检查点持久化
- 确保使用相同的 thread_id
- 检查检查点存储是否正常

### 13.2 循环检测误报

**问题**: 正常操作被误判为循环

**解决方案**:
- 调整 warn_threshold 和 hard_limit
- 检查工具调用是否确实重复
- 查看日志了解触发原因

### 13.3 内存更新延迟

**问题**: 内存更新不及时

**解决方案**:
- 检查内存队列是否正常工作
- 查看内存更新器日志
- 确认内存配置是否正确

### 13.4 工具加载失败

**问题**: 工具无法加载

**解决方案**:
- 检查工具配置路径
- 确认依赖包已安装
- 查看错误日志

## 十四、未来规划

### 14.1 LangGraph 升级

- 跟进 LangGraph 新版本
- 利用新特性优化性能
- 改进状态管理

### 14.2 功能增强

- 支持更多检查点后端
- 改进中间件机制
- 增强调试能力

### 14.3 性能优化

- 减少状态大小
- 优化流式输出
- 改进并发处理
