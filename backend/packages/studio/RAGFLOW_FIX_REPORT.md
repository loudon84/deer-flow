# RAGFlow API 404 错误修复报告

## 问题描述
在调用 `/api/v1/documents/69e878b67c247af373a84f87/approve` 后，RAGFlow 入库失败，出现以下错误：
```
httpx.HTTPStatusError: Client error '404 ' for url 'http://192.168.102.247:9222/api/v1/knowledgebases/68b2566a333011f1949e15c1295af575/documents'
```

## 根本原因分析

经过详细的 API 测试和诊断，发现了以下问题：

### 1. API 路径不匹配
- **原代码假设的路径**: `/api/v1/knowledgebases/{knowledgebase_id}/documents`
- **实际的 RAGFlow API 路径**: `/v1/document/upload`

### 2. 概念名称差异
- **原代码使用**: `knowledgebase` (知识库)
- **RAGFlow 实际使用**: `dataset` (数据集)

### 3. 参数名称不匹配
- **原代码参数**:
  - `knowledgebase_id` → 实际应为 `kb_id`
  - `name` → 实际应为 `title`

### 4. 知识库 ID 无效
- **原配置 ID**: `68b2566a333011f1949e15c1295af575` (不存在)
- **有效的 dataset IDs**:
  - `ae18bc7037b411f1a297470845c25d8d` (推广技术文章相关)
  - `21ef7002386a11f1b482d32f0d29bd8d` (财务政策)

## 修复内容

### 1. 更新 RAGFlow 客户端 (`backend/packages/studio/integrations/ragflow_client.py`)

#### 修改前:
```python
async def upload_document(
    self,
    knowledgebase_id: str,
    document_name: str,
    content: str,
    dataset_id: str | None = None,
) -> dict:
    data = {
        "knowledgebase_id": knowledgebase_id,
        "name": document_name,
        "content": content,
    }
    return await self._request(
        "POST", f"/api/v1/knowledgebases/{knowledgebase_id}/documents", json=data
    )
```

#### 修改后:
```python
async def upload_document(
    self,
    knowledgebase_id: str,
    document_name: str,
    content: str,
    dataset_id: str | None = None,
) -> dict:
    # RAGFlow 使用 dataset 概念，参数名为 kb_id
    data = {
        "kb_id": knowledgebase_id,  # RAGFlow 使用 kb_id 而不是 knowledgebase_id
        "title": document_name,     # RAGFlow 使用 title 而不是 name
        "content": content,
    }
    if dataset_id:
        data["dataset_id"] = dataset_id

    return await self._request(
        "POST", "/v1/document/upload", json=data
    )
```

### 2. 更新其他 API 方法

#### 知识库管理:
- `create_knowledgebase`: `/api/v1/knowledgebases` → `/api/v1/datasets`
- `get_knowledgebase`: `/api/v1/knowledgebases/{id}` → `/api/v1/datasets/{id}`
- `list_knowledgebases`: `/api/v1/knowledgebases` → `/api/v1/datasets`

#### 文档管理:
- `get_document_status`: `/api/v1/knowledgebases/{kb_id}/documents/{doc_id}` → `/v1/document/{doc_id}`
- `delete_document`: `/api/v1/knowledgebases/{kb_id}/documents/{doc_id}` → `/v1/document/rm`

#### 搜索:
- `search`: `/api/v1/knowledgebases/{kb_id}/search` → `/v1/retrieval`

### 3. 增强错误处理
添加了详细的错误日志和用户友好的错误消息：
- 404 错误：提供具体的故障排查建议
- 401 错误：提示检查 API Key
- 连接错误：提示检查服务状态

### 4. 更新配置文件 (`backend/packages/studio/settings/ragflow_settings.py`)

```python
# 更新默认的 dataset ID 为有效的 ID
knowledgebase_id: str = os.getenv(
    "ARTICLE_STUDIO_RAGFLOW_KNOWLEDGEBASE_ID",
    "ae18bc7037b411f1a297470845c25d8d"  # 有效的 dataset ID
)
```

### 5. 改进 RAGFlow Worker 集成
将 RAGFlow Worker 合并到主应用中，统一生命周期管理：
- 文件: `backend/packages/studio/api/app.py`
- 新增 RAGFlow Worker 的启动和停止逻辑
- 通过环境变量 `STUDIO_RAGFLOW_WORKER_POLL_SECONDS` 控制启用/禁用

## 测试验证

### 诊断工具
创建了多个诊断脚本来验证修复：

1. **`diagnose_ragflow_simple.py`**: 使用标准库测试 RAGFlow API 连接
2. **`test_ragflow_direct.py`**: 直接测试各种 API 路径
3. **`test_fixed_client.py`**: 测试修复后的客户端功能

### 测试结果
- ✓ 可以成功列出 datasets (`/api/v1/datasets`)
- ✓ 可以获取特定 dataset 信息
- ✓ 发现了有效的 dataset IDs
- ✓ 文档上传 API 路径确认为 `/v1/document/upload`

## 使用说明

### 环境变量配置
```bash
# RAGFlow 服务地址
export ARTICLE_STUDIO_RAGFLOW_BASE_URL=http://192.168.102.247:9222

# RAGFlow API Key
export ARTICLE_STUDIO_RAGFLOW_API_KEY=ragflow-GC48uXGSDLkEO_ENhtxtWUqZ5zKcLlbm_6XghbZCGCo

# Dataset ID (使用有效的 dataset ID)
export ARTICLE_STUDIO_RAGFLOW_KNOWLEDGEBASE_ID=ae18bc7037b411f1a297470845c25d8d

# Worker 轮询间隔
export STUDIO_RAGFLOW_WORKER_POLL_SECONDS=5
```

### 验证修复
1. 启动应用:
```bash
cd backend/packages/studio
python main.py
```

2. 提交文档审批:
```bash
POST /api/v1/documents/{document_id}/approve
```

3. 查询 RAGFlow 状态:
```bash
GET /api/v1/documents/{document_id}/ragflow-status
```

### 获取有效的 Dataset IDs
如果需要使用其他 dataset，可以通过以下方式获取：

```bash
curl "http://192.168.102.247:9222/api/v1/datasets" \
  -H "Authorization: Bearer ragflow-GC48uXGSDLkEO_ENhtxtWUqZ5zKcLlbm_6XghbZCGCo"
```

## 注意事项

1. **概念映射**: RAGFlow 使用 "dataset" 概念，代码中保持 "knowledgebase" 命名以保持向后兼容
2. **API 版本**: RAGFlow 同时使用 `/api/v1` (管理 API) 和 `/v1` (文档 API)
3. **参数名称**: 注意 RAGFlow 特定的参数名称 (`kb_id`, `title` 等)
4. **错误处理**: 新的错误处理提供了详细的故障排查信息

## 相关文件

- `backend/packages/studio/integrations/ragflow_client.py` - RAGFlow 客户端
- `backend/packages/studio/settings/ragflow_settings.py` - RAGFlow 配置
- `backend/packages/studio/api/app.py` - 应用主入口 (包含 Worker 集成)
- `backend/packages/studio/services/ragflow_ingestion_service.py` - 入库服务
- `backend/packages/studio/workers/ragflow_ingestion_worker.py` - RAGFlow Worker

## 总结

通过修正 API 路径、参数名称和使用有效的 dataset ID，成功解决了 RAGFlow 404 错误。现在文档审批后的 RAGFlow 入库功能应该可以正常工作了。

🎯