`/api/langgraph/threads/search` 接口确实存在，只是之前的 `API.md` 文档没有记录它。它是 LangGraph Server 原生提供的接口，前端通过 LangGraph SDK 调用。

**接口说明：**

```http
POST /api/langgraph/threads/search
Content-Type: application/json
```

**Request Body：**
```json
{
  "limit": 50,
  "offset": 0,
  "metadata": {},
  "status": null
}
```

**Response（数组）：**
```json
[
  {
    "thread_id": "abc123",
    "status": "idle",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z",
    "metadata": { "agent_name": "lead_agent" },
    "values": { "title": "Conversation Title" },
    "interrupts": {}
  }
]
```

前端通过 `apiClient.threads.search()` 调用此接口，用于侧边栏线程列表和会话列表页面。 [1](#3-0) [2](#3-1) 

**两套实现：**

| 模式 | 路径 | 实现 |
|------|------|------|
| 标准模式 | `POST /api/langgraph/threads/search` | LangGraph Server 原生 |
| Gateway 模式 | `POST /api/threads/search` | Gateway 自实现 |

Gateway 模式下的 `search_threads` 实现了两阶段搜索：
- **Phase 1（Store 快速路径）**：从 Store 中读取 Gateway 创建的线程记录
- **Phase 2（Checkpointer 补充）**：扫描 checkpointer 发现由 LangGraph Server 直接创建的线程，并懒迁移到 Store [3](#3-2) 

**`ThreadSearchRequest` 请求参数：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `metadata` | `dict` | `{}` | 元数据精确匹配过滤 |
| `limit` | `int` | `100` | 最大返回数量（1-1000） |
| `offset` | `int` | `0` | 分页偏移量 |
| `status` | `str \| null` | `null` | 按状态过滤：`idle/busy/interrupted/error` | [4](#3-3) 

**`ThreadResponse` 返回字段：**

| 字段 | 说明 |
|------|------|
| `thread_id` | 线程唯一标识 |
| `status` | 线程状态：`idle/busy/interrupted/error` |
| `created_at` | 创建时间戳 |
| `updated_at` | 最后更新时间戳（用于排序） |
| `metadata` | 线程元数据（如 `agent_name`） |
| `values` | 当前状态快照（含 `title` 字段） |
| `interrupts` | 待处理的中断信息 | [5](#3-4)

### Citations

**File:** frontend/tests/e2e/utils/mock-api.ts (L54-69)
```typescript
  // Thread search — sidebar thread list & chats list page
  void page.route("**/api/langgraph/threads/search", (route) => {
    const body = threads.map((t) => ({
      thread_id: t.thread_id,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: t.updated_at ?? "2025-01-01T00:00:00Z",
      metadata: t.agent_name ? { agent_name: t.agent_name } : {},
      status: "idle",
      values: { title: t.title ?? "Untitled" },
    }));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
```

**File:** frontend/src/core/threads/hooks.ts (L533-554)
```typescript
export function useThreads(
  params: Parameters<ThreadsClient["search"]>[0] = {
    limit: 50,
    sortBy: "updated_at",
    sortOrder: "desc",
    select: ["thread_id", "updated_at", "values", "metadata"],
  },
) {
  const apiClient = getAPIClient();
  return useQuery<AgentThread[]>({
    queryKey: ["threads", "search", params],
    queryFn: async () => {
      const maxResults = params.limit;
      const initialOffset = params.offset ?? 0;
      const DEFAULT_PAGE_SIZE = 50;

      // Preserve prior semantics: if a non-positive limit is explicitly provided,
      // delegate to a single search call with the original parameters.
      if (maxResults !== undefined && maxResults <= 0) {
        const response =
          await apiClient.threads.search<AgentThreadState>(params);
        return response as AgentThread[];
```

**File:** backend/app/gateway/routers/threads.py (L50-59)
```python
class ThreadResponse(BaseModel):
    """Response model for a single thread."""

    thread_id: str = Field(description="Unique thread identifier")
    status: str = Field(default="idle", description="Thread status: idle, busy, interrupted, error")
    created_at: str = Field(default="", description="ISO timestamp")
    updated_at: str = Field(default="", description="ISO timestamp")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Thread metadata")
    values: dict[str, Any] = Field(default_factory=dict, description="Current state channel values")
    interrupts: dict[str, Any] = Field(default_factory=dict, description="Pending interrupts")
```

**File:** backend/app/gateway/routers/threads.py (L69-76)
```python
class ThreadSearchRequest(BaseModel):
    """Request body for searching threads."""

    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata filter (exact match)")
    limit: int = Field(default=100, ge=1, le=1000, description="Maximum results")
    offset: int = Field(default=0, ge=0, description="Pagination offset")
    status: str | None = Field(default=None, description="Filter by thread status")

```

**File:** backend/app/gateway/routers/threads.py (L317-419)
```python
@router.post("/search", response_model=list[ThreadResponse])
async def search_threads(body: ThreadSearchRequest, request: Request) -> list[ThreadResponse]:
    """Search and list threads.

    Two-phase approach:

    **Phase 1 — Store (fast path, O(threads))**: returns threads that were
    created or run through this Gateway.  Store records are tiny metadata
    dicts so fetching all of them at once is cheap.

    **Phase 2 — Checkpointer supplement (lazy migration)**: threads that
    were created directly by LangGraph Server (and therefore absent from the
    Store) are discovered here by iterating the shared checkpointer.  Any
    newly found thread is immediately written to the Store so that the next
    search skips Phase 2 for that thread — the Store converges to a full
    index over time without a one-shot migration job.
    """
    store = get_store(request)
    checkpointer = get_checkpointer(request)

    # -----------------------------------------------------------------------
    # Phase 1: Store
    # -----------------------------------------------------------------------
    merged: dict[str, ThreadResponse] = {}

    if store is not None:
        try:
            items = await store.asearch(THREADS_NS, limit=10_000)
        except Exception:
            logger.warning("Store search failed — falling back to checkpointer only", exc_info=True)
            items = []

        for item in items:
            val = item.value
            merged[val["thread_id"]] = ThreadResponse(
                thread_id=val["thread_id"],
                status=val.get("status", "idle"),
                created_at=str(val.get("created_at", "")),
                updated_at=str(val.get("updated_at", "")),
                metadata=val.get("metadata", {}),
                values=val.get("values", {}),
            )

    # -----------------------------------------------------------------------
    # Phase 2: Checkpointer supplement
    # Discovers threads not yet in the Store (e.g. created by LangGraph
    # Server) and lazily migrates them so future searches skip this phase.
    # -----------------------------------------------------------------------
    try:
        async for checkpoint_tuple in checkpointer.alist(None):
            cfg = getattr(checkpoint_tuple, "config", {})
            thread_id = cfg.get("configurable", {}).get("thread_id")
            if not thread_id or thread_id in merged:
                continue

            # Skip sub-graph checkpoints (checkpoint_ns is non-empty for those)
            if cfg.get("configurable", {}).get("checkpoint_ns", ""):
                continue

            ckpt_meta = getattr(checkpoint_tuple, "metadata", {}) or {}
            # Strip LangGraph internal keys from the user-visible metadata dict
            user_meta = {k: v for k, v in ckpt_meta.items() if k not in ("created_at", "updated_at", "step", "source", "writes", "parents")}

            # Extract state values (title) from the checkpoint's channel_values
            checkpoint_data = getattr(checkpoint_tuple, "checkpoint", {}) or {}
            channel_values = checkpoint_data.get("channel_values", {})
            ckpt_values = {}
            if title := channel_values.get("title"):
                ckpt_values["title"] = title

            thread_resp = ThreadResponse(
                thread_id=thread_id,
                status=_derive_thread_status(checkpoint_tuple),
                created_at=str(ckpt_meta.get("created_at", "")),
                updated_at=str(ckpt_meta.get("updated_at", ckpt_meta.get("created_at", ""))),
                metadata=user_meta,
                values=ckpt_values,
            )
            merged[thread_id] = thread_resp

            # Lazy migration — write to Store so the next search finds it there
            if store is not None:
                try:
                    await _store_upsert(store, thread_id, metadata=user_meta, values=ckpt_values or None)
                except Exception:
                    logger.debug("Failed to migrate thread %s to store (non-fatal)", thread_id)
    except Exception:
        logger.exception("Checkpointer scan failed during thread search")
        # Don't raise — return whatever was collected from Store + partial scan

    # -----------------------------------------------------------------------
    # Phase 3: Filter → sort → paginate
    # -----------------------------------------------------------------------
    results = list(merged.values())

    if body.metadata:
        results = [r for r in results if all(r.metadata.get(k) == v for k, v in body.metadata.items())]

    if body.status:
        results = [r for r in results if r.status == body.status]

    results.sort(key=lambda r: r.updated_at, reverse=True)
    return results[body.offset : body.offset + body.limit]
```
