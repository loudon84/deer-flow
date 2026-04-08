# 《Article Studio FastAPI 路由文件 + Repository 完整实现 + Mongo 索引初始化脚本 + Worker 启动入口》

## 1. 文档目标

本文档直接作为 `Cursor` 的实现规格，目标是让其基于既定架构完成 `Article Studio` 后端第一版代码落地。
范围限定为：

* FastAPI 路由文件
* Repository 完整实现
* MongoDB 索引初始化脚本
* Generation Worker
* RAGFlow Ingestion Worker
* Worker 启动入口
* 与独立 Model Factory 的调用对接

不包含：

* 前端页面
* 发布渠道
* 权限系统细粒度实现
* 审计中心高级能力
* RAGFlow 全量 SDK 抽象

`Article Studio` 是独立业务模块，不绑定 DeerFlow 原 Lead Agent/ThreadState 主链；DeerFlow 原生更适合 Agent Runtime，而不是文章资产主存储。RAGFlow 则用于审批通过后的知识化入库。 

---

# 2. 实施原则

## 2.1 硬约束

### 存储

* **MongoDB 为主存储**
* **sandbox/虚拟文件夹仅为临时工作区**
* **审批通过后写入 RAGFlow**

### 配置

* `Article Studio` 模型配置独立，不读取 DeerFlow 原 `config.yaml`
* 使用独立 `article-models.yaml`
* 环境变量前缀统一为 `ARTICLE_*`

### 代码边界

* `article_studio.*` 不得 import `deerflow.agents.*`
* `article_studio.*` 不得调用 DeerFlow 原 `create_chat_model()`
* `Article Studio` 通过独立 `ArticleModelFactory` 获取模型实例

---

# 3. 目标目录结构

```text
backend/
├── article_studio/
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── app.py
│   │   ├── deps.py
│   │   ├── router_templates.py
│   │   ├── router_jobs.py
│   │   ├── router_documents.py
│   │   └── router_health.py
│   ├── db/
│   │   ├── __init__.py
│   │   ├── mongo.py
│   │   ├── collections.py
│   │   └── indexes.py
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── model_factory_adapter.py
│   │   └── ragflow_client.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── dto/
│   │   │   ├── __init__.py
│   │   │   ├── template_dto.py
│   │   │   ├── job_dto.py
│   │   │   ├── document_dto.py
│   │   │   └── common_dto.py
│   │   └── persistence/
│   │       ├── __init__.py
│   │       ├── template_doc.py
│   │       ├── template_version_doc.py
│   │       ├── job_doc.py
│   │       ├── document_doc.py
│   │       ├── approval_doc.py
│   │       └── ragflow_task_doc.py
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── template_repository.py
│   │   ├── template_version_repository.py
│   │   ├── job_repository.py
│   │   ├── document_repository.py
│   │   ├── approval_repository.py
│   │   └── ragflow_task_repository.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── prompt_render_service.py
│   │   ├── template_service.py
│   │   ├── article_generation_service.py
│   │   ├── approval_service.py
│   │   ├── ragflow_ingestion_service.py
│   │   └── strategy/
│   │       ├── __init__.py
│   │       ├── base.py
│   │       ├── single_pass.py
│   │       ├── outline_then_write.py
│   │       └── registry.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── article_studio_settings.py
│   │   └── ragflow_settings.py
│   ├── workers/
│   │   ├── __init__.py
│   │   ├── generation_worker.py
│   │   ├── ragflow_ingestion_worker.py
│   │   ├── run_generation_worker.py
│   │   └── run_ragflow_worker.py
│   └── scripts/
│       └── init_mongo_indexes.py
└── article-models.yaml
```

---

# 4. 技术栈约束

## 4.1 后端框架

* FastAPI
* Pydantic v2
* Motor（MongoDB async）
* httpx
* Jinja2
* uvicorn

## 4.2 不允许

* 同步版 PyMongo 直接跑在 API 请求线程里
* 直接在路由层写 Mongo 查询
* 把业务逻辑塞入 Router
* Worker 复用 HTTP 请求入口函数

---

# 5. 配置规范

## 5.1 环境变量

```bash
ARTICLE_STUDIO_HOST=0.0.0.0
ARTICLE_STUDIO_PORT=8320

ARTICLE_STUDIO_MONGODB_URI=mongodb://localhost:27017
ARTICLE_STUDIO_MONGODB_DB=article_studio

ARTICLE_STUDIO_RAGFLOW_BASE_URL=http://127.0.0.1:9380
ARTICLE_STUDIO_RAGFLOW_API_KEY=xxx

ARTICLE_STUDIO_MODEL_CONFIG_PATH=./article-models.yaml

ARTICLE_WORKER_POLL_SECONDS=3
ARTICLE_RAGFLOW_WORKER_POLL_SECONDS=5
```

## 5.2 `settings/article_studio_settings.py`

```python
from pydantic import BaseModel
import os


class ArticleStudioSettings(BaseModel):
    host: str = os.getenv("ARTICLE_STUDIO_HOST", "0.0.0.0")
    port: int = int(os.getenv("ARTICLE_STUDIO_PORT", "8320"))
    mongodb_uri: str = os.getenv("ARTICLE_STUDIO_MONGODB_URI", "mongodb://localhost:27017")
    mongodb_db: str = os.getenv("ARTICLE_STUDIO_MONGODB_DB", "article_studio")
    worker_poll_seconds: int = int(os.getenv("ARTICLE_WORKER_POLL_SECONDS", "3"))
    ragflow_worker_poll_seconds: int = int(os.getenv("ARTICLE_RAGFLOW_WORKER_POLL_SECONDS", "5"))
```

## 5.3 `settings/ragflow_settings.py`

```python
from pydantic import BaseModel
import os


class RagflowSettings(BaseModel):
    base_url: str = os.getenv("ARTICLE_STUDIO_RAGFLOW_BASE_URL", "http://127.0.0.1:9380")
    api_key: str = os.getenv("ARTICLE_STUDIO_RAGFLOW_API_KEY", "")
    timeout_seconds: int = int(os.getenv("ARTICLE_STUDIO_RAGFLOW_TIMEOUT_SECONDS", "60"))
```

---

# 6. MongoDB 集合定义

## 6.1 集合名常量

### `db/collections.py`

```python
from article_studio.db.mongo import get_mongo_manager

COLLECTION_ARTICLE_TEMPLATES = "article_templates"
COLLECTION_ARTICLE_TEMPLATE_VERSIONS = "article_template_versions"
COLLECTION_ARTICLE_JOBS = "article_jobs"
COLLECTION_ARTICLE_DOCUMENTS = "article_documents"
COLLECTION_ARTICLE_APPROVALS = "article_approvals"
COLLECTION_ARTICLE_RAGFLOW_TASKS = "article_ragflow_tasks"


def get_collection(name: str):
    return get_mongo_manager().db[name]
```

## 6.2 Mongo Manager

### `db/mongo.py`

```python
from functools import lru_cache
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from article_studio.settings.article_studio_settings import ArticleStudioSettings


class MongoManager:
    def __init__(self, uri: str, db_name: str) -> None:
        self.client = AsyncIOMotorClient(uri)
        self.db = self.client[db_name]


@lru_cache(maxsize=1)
def get_mongo_manager() -> MongoManager:
    settings = ArticleStudioSettings()
    return MongoManager(settings.mongodb_uri, settings.mongodb_db)
```

---

# 7. Mongo 索引初始化脚本

## 7.1 设计要求

* 支持重复执行
* 不抛出重复索引异常
* 用于本地初始化与 CI 启动阶段
* 不绑定 API 启动流程强依赖，但 API 启动时可以尝试 ensure

## 7.2 `db/indexes.py`

```python
from article_studio.db.collections import get_collection


async def ensure_indexes() -> None:
    templates = get_collection("article_templates")
    template_versions = get_collection("article_template_versions")
    jobs = get_collection("article_jobs")
    documents = get_collection("article_documents")
    approvals = get_collection("article_approvals")
    ragflow_tasks = get_collection("article_ragflow_tasks")

    await templates.create_index("code", unique=True)
    await templates.create_index("status")
    await templates.create_index("category")
    await templates.create_index("updatedAt")

    await template_versions.create_index(
        [("templateId", 1), ("version", -1)],
        unique=True,
    )

    await jobs.create_index("status")
    await jobs.create_index("userId")
    await jobs.create_index("templateId")
    await jobs.create_index("createdAt")

    await documents.create_index("jobId")
    await documents.create_index("templateId")
    await documents.create_index("approvalStatus")
    await documents.create_index("ragflowStatus")
    await documents.create_index("updatedAt")

    await approvals.create_index("documentId")
    await approvals.create_index("status")
    await approvals.create_index("createdAt")

    await ragflow_tasks.create_index("status")
    await ragflow_tasks.create_index(
        [("documentId", 1), ("documentVersion", 1)],
        unique=True,
    )
    await ragflow_tasks.create_index("createdAt")
```

## 7.3 `scripts/init_mongo_indexes.py`

```python
import asyncio
from article_studio.db.indexes import ensure_indexes


async def main():
    await ensure_indexes()
    print("Mongo indexes ensured.")


if __name__ == "__main__":
    asyncio.run(main())
```

---

# 8. Pydantic DTO 规范

## 8.1 通用响应

### `models/dto/common_dto.py`

```python
from pydantic import BaseModel


class OkResponse(BaseModel):
    ok: bool = True


class IdResponse(BaseModel):
    id: str
```

## 8.2 模板 DTO

### `models/dto/template_dto.py`

```python
from pydantic import BaseModel, Field
from typing import Any


class TemplateCreateRequest(BaseModel):
    code: str
    name: str
    description: str | None = None
    category: str
    tags: list[str] = Field(default_factory=list)
    schema: dict[str, Any]
    system_prompt: str | None = None
    user_prompt_template: str
    default_model_name: str
    default_generation_mode: str


class TemplateUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class TemplateVersionCreateRequest(BaseModel):
    schema: dict[str, Any]
    system_prompt: str | None = None
    user_prompt_template: str
    default_model_name: str
    default_generation_mode: str
    example_input: dict[str, Any] | None = None
    example_output: str | None = None


class TemplateResponse(BaseModel):
    id: str
    code: str
    name: str
    description: str | None = None
    category: str
    status: str
    current_version: int
    default_model_name: str
    default_generation_mode: str
    tags: list[str]
```

## 8.3 任务 DTO

### `models/dto/job_dto.py`

```python
from pydantic import BaseModel
from typing import Any


class JobCreateRequest(BaseModel):
    template_id: str
    title: str
    input_params: dict[str, Any]
    generation_mode: str | None = None
    model_name: str | None = None
    prompt_override: str | None = None


class JobResponse(BaseModel):
    id: str
    status: str
    document_id: str | None = None
    last_error: str | None = None
```

## 8.4 文档 DTO

### `models/dto/document_dto.py`

```python
from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: str
    title: str
    content_markdown: str
    summary: str | None = None
    keywords: list[str]
    approval_status: str
    ragflow_status: str
    version: int


class DocumentUpdateRequest(BaseModel):
    title: str | None = None
    content_markdown: str
    summary: str | None = None
    keywords: list[str] | None = None


class SubmitApprovalRequest(BaseModel):
    comment: str | None = None


class ApproveDocumentRequest(BaseModel):
    comment: str | None = None
    knowledgebase_id: str
    dataset_id: str | None = None


class RejectDocumentRequest(BaseModel):
    comment: str
```

---

# 9. Persistence 文档模型规范

说明：`persistence/*.py` 不是 ODM，不引入 Beanie/MongoEngine，只用于定义字段约定与 helper。

## 9.1 `models/persistence/job_doc.py`

```python
JOB_STATUS_QUEUED = "queued"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_SUCCEEDED = "succeeded"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"
```

## 9.2 `models/persistence/document_doc.py`

```python
APPROVAL_STATUS_DRAFT = "draft"
APPROVAL_STATUS_PENDING = "pending_approval"
APPROVAL_STATUS_APPROVED = "approved"
APPROVAL_STATUS_REJECTED = "rejected"

RAGFLOW_STATUS_NOT_INDEXED = "not_indexed"
RAGFLOW_STATUS_QUEUED = "queued"
RAGFLOW_STATUS_INDEXING = "indexing"
RAGFLOW_STATUS_INDEXED = "indexed"
RAGFLOW_STATUS_FAILED = "failed"
RAGFLOW_STATUS_STALE = "stale"
```

---

# 10. Repository 完整实现要求

## 10.1 Repository 设计准则

* 所有 Mongo 操作必须经 Repository
* Router 不直接操作集合
* Service 不直接写原始 query，除非必要
* ObjectId 转换统一在 Repository 内处理
* 返回值统一为原始 dict，不在 Repository 内做 DTO 序列化

---

## 10.2 TemplateRepository

### `repositories/template_repository.py`

```python
from datetime import datetime, timezone
from bson import ObjectId

from article_studio.db.collections import get_collection


class TemplateRepository:
    def __init__(self) -> None:
        self.col = get_collection("article_templates")

    async def create(self, payload: dict) -> str:
        now = datetime.now(timezone.utc)
        doc = {
            "code": payload["code"],
            "name": payload["name"],
            "description": payload.get("description"),
            "category": payload["category"],
            "status": "active",
            "currentVersion": 1,
            "defaultModelName": payload["default_model_name"],
            "defaultGenerationMode": payload["default_generation_mode"],
            "tags": payload.get("tags", []),
            "createdBy": payload.get("created_by", "system"),
            "createdAt": now,
            "updatedAt": now,
        }
        result = await self.col.insert_one(doc)
        return str(result.inserted_id)

    async def get(self, template_id: str) -> dict | None:
        return await self.col.find_one({"_id": ObjectId(template_id)})

    async def get_by_code(self, code: str) -> dict | None:
        return await self.col.find_one({"code": code})

    async def list(self, filters: dict | None = None, limit: int = 50) -> list[dict]:
        query = filters or {}
        cursor = self.col.find(query).sort("updatedAt", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def update(self, template_id: str, patch: dict) -> None:
        patch["updatedAt"] = datetime.now(timezone.utc)
        await self.col.update_one(
            {"_id": ObjectId(template_id)},
            {"$set": patch},
        )

    async def set_current_version(self, template_id: str, version: int) -> None:
        await self.col.update_one(
            {"_id": ObjectId(template_id)},
            {
                "$set": {
                    "currentVersion": version,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
```

---

## 10.3 TemplateVersionRepository

### `repositories/template_version_repository.py`

```python
from datetime import datetime, timezone
from bson import ObjectId

from article_studio.db.collections import get_collection


class TemplateVersionRepository:
    def __init__(self) -> None:
        self.col = get_collection("article_template_versions")

    async def create(self, payload: dict) -> str:
        now = datetime.now(timezone.utc)
        result = await self.col.insert_one(
            {
                "templateId": payload["templateId"],
                "version": payload["version"],
                "schema": payload["schema"],
                "systemPrompt": payload.get("system_prompt"),
                "userPromptTemplate": payload["user_prompt_template"],
                "defaultModelName": payload["default_model_name"],
                "defaultGenerationMode": payload["default_generation_mode"],
                "exampleInput": payload.get("example_input"),
                "exampleOutput": payload.get("example_output"),
                "createdBy": payload.get("created_by", "system"),
                "createdAt": now,
            }
        )
        return str(result.inserted_id)

    async def get(self, version_id: str) -> dict | None:
        return await self.col.find_one({"_id": ObjectId(version_id)})

    async def get_current_version(self, template_id: str) -> dict | None:
        return await self.col.find_one(
            {"templateId": template_id},
            sort=[("version", -1)],
        )

    async def list_by_template(self, template_id: str) -> list[dict]:
        cursor = self.col.find({"templateId": template_id}).sort("version", -1)
        return await cursor.to_list(length=100)
```

---

## 10.4 JobRepository

### `repositories/job_repository.py`

```python
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import ReturnDocument

from article_studio.db.collections import get_collection


class JobRepository:
    def __init__(self) -> None:
        self.col = get_collection("article_jobs")

    async def create(self, payload: dict) -> str:
        now = datetime.now(timezone.utc)
        result = await self.col.insert_one(
            {
                "templateId": payload["templateId"],
                "title": payload["title"],
                "inputParams": payload["inputParams"],
                "generationMode": payload.get("generationMode"),
                "modelName": payload.get("modelName"),
                "promptOverride": payload.get("promptOverride"),
                "status": "queued",
                "attempts": 0,
                "lastError": None,
                "documentId": None,
                "userId": payload["userId"],
                "createdAt": now,
                "startedAt": None,
                "finishedAt": None,
                "updatedAt": now,
            }
        )
        return str(result.inserted_id)

    async def get(self, job_id: str) -> dict | None:
        return await self.col.find_one({"_id": ObjectId(job_id)})

    async def claim_next_queued_job(self) -> dict | None:
        now = datetime.now(timezone.utc)
        return await self.col.find_one_and_update(
            {"status": "queued"},
            {
                "$set": {
                    "status": "running",
                    "startedAt": now,
                    "updatedAt": now,
                },
                "$inc": {"attempts": 1},
            },
            sort=[("createdAt", 1)],
            return_document=ReturnDocument.AFTER,
        )

    async def mark_succeeded(self, job_id: str, document_id: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": "succeeded",
                    "documentId": document_id,
                    "finishedAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def mark_failed(self, job_id: str, error: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": "failed",
                    "lastError": error,
                    "finishedAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def requeue(self, job_id: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": "queued",
                    "lastError": None,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
```

---

## 10.5 DocumentRepository

### `repositories/document_repository.py`

```python
from datetime import datetime, timezone
from bson import ObjectId

from article_studio.db.collections import get_collection


class DocumentRepository:
    def __init__(self) -> None:
        self.col = get_collection("article_documents")

    async def create(self, payload: dict) -> str:
        now = datetime.now(timezone.utc)
        result = await self.col.insert_one(
            {
                "jobId": payload["jobId"],
                "templateId": payload["templateId"],
                "templateVersionId": payload["templateVersionId"],
                "title": payload["title"],
                "contentMarkdown": payload["contentMarkdown"],
                "contentText": payload["contentText"],
                "summary": payload.get("summary"),
                "keywords": payload.get("keywords", []),
                "version": payload.get("version", 1),
                "isCurrent": True,
                "approvalStatus": "draft",
                "ragflowStatus": "not_indexed",
                "ragflowKnowledgebaseId": None,
                "ragflowDocumentId": None,
                "metadata": payload["metadata"],
                "createdBy": payload["createdBy"],
                "createdAt": now,
                "updatedAt": now,
            }
        )
        return str(result.inserted_id)

    async def get(self, document_id: str) -> dict | None:
        return await self.col.find_one({"_id": ObjectId(document_id)})

    async def update_draft(self, document_id: str, patch: dict) -> None:
        patch["updatedAt"] = datetime.now(timezone.utc)
        await self.col.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": patch},
        )

    async def submit_for_approval(self, document_id: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(document_id)},
            {
                "$set": {
                    "approvalStatus": "pending_approval",
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def mark_approved(self, document_id: str, knowledgebase_id: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(document_id)},
            {
                "$set": {
                    "approvalStatus": "approved",
                    "ragflowStatus": "queued",
                    "ragflowKnowledgebaseId": knowledgebase_id,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def mark_rejected(self, document_id: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(document_id)},
            {
                "$set": {
                    "approvalStatus": "rejected",
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def mark_ragflow_status(
        self,
        document_id: str,
        status: str,
        ragflow_document_id: str | None = None,
    ) -> None:
        patch = {
            "ragflowStatus": status,
            "updatedAt": datetime.now(timezone.utc),
        }
        if ragflow_document_id is not None:
            patch["ragflowDocumentId"] = ragflow_document_id

        await self.col.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": patch},
        )
```

---

## 10.6 ApprovalRepository

### `repositories/approval_repository.py`

```python
from datetime import datetime, timezone

from article_studio.db.collections import get_collection


class ApprovalRepository:
    def __init__(self) -> None:
        self.col = get_collection("article_approvals")

    async def create(self, payload: dict) -> str:
        result = await self.col.insert_one(
            {
                "documentId": payload["documentId"],
                "status": payload["status"],
                "approverId": payload.get("approverId"),
                "comment": payload.get("comment"),
                "createdAt": datetime.now(timezone.utc),
            }
        )
        return str(result.inserted_id)

    async def list_by_document(self, document_id: str) -> list[dict]:
        cursor = self.col.find({"documentId": document_id}).sort("createdAt", -1)
        return await cursor.to_list(length=100)
```

---

## 10.7 RagflowTaskRepository

### `repositories/ragflow_task_repository.py`

```python
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import ReturnDocument

from article_studio.db.collections import get_collection


class RagflowTaskRepository:
    def __init__(self) -> None:
        self.col = get_collection("article_ragflow_tasks")

    async def create(self, payload: dict) -> str:
        now = datetime.now(timezone.utc)
        result = await self.col.insert_one(
            {
                "documentId": payload["documentId"],
                "documentVersion": payload["documentVersion"],
                "knowledgebaseId": payload["knowledgebaseId"],
                "datasetId": payload.get("datasetId"),
                "status": "queued",
                "attempts": 0,
                "lastError": None,
                "payload": payload["payload"],
                "createdAt": now,
                "startedAt": None,
                "finishedAt": None,
                "updatedAt": now,
            }
        )
        return str(result.inserted_id)

    async def claim_next_queued_task(self) -> dict | None:
        now = datetime.now(timezone.utc)
        return await self.col.find_one_and_update(
            {"status": "queued"},
            {
                "$set": {
                    "status": "running",
                    "startedAt": now,
                    "updatedAt": now,
                },
                "$inc": {"attempts": 1},
            },
            sort=[("createdAt", 1)],
            return_document=ReturnDocument.AFTER,
        )

    async def mark_succeeded(self, task_id: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$set": {
                    "status": "succeeded",
                    "finishedAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def mark_failed(self, task_id: str, error: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$set": {
                    "status": "failed",
                    "lastError": error,
                    "finishedAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def requeue(self, task_id: str) -> None:
        await self.col.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$set": {
                    "status": "queued",
                    "lastError": None,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
```

---

# 11. Service 完整实现要求

## 11.1 PromptRenderService

### `services/prompt_render_service.py`

```python
from jinja2 import Template


class PromptRenderService:
    def render(self, template_text: str, params: dict) -> str:
        return Template(template_text).render(**params)
```

---

## 11.2 TemplateService

### `services/template_service.py`

```python
from article_studio.repositories.template_repository import TemplateRepository
from article_studio.repositories.template_version_repository import TemplateVersionRepository


class TemplateService:
    def __init__(self):
        self.template_repo = TemplateRepository()
        self.template_version_repo = TemplateVersionRepository()

    async def create_template(self, payload: dict) -> str:
        template_id = await self.template_repo.create(payload)

        await self.template_version_repo.create(
            {
                "templateId": template_id,
                "version": 1,
                "schema": payload["schema"],
                "system_prompt": payload.get("system_prompt"),
                "user_prompt_template": payload["user_prompt_template"],
                "default_model_name": payload["default_model_name"],
                "default_generation_mode": payload["default_generation_mode"],
                "created_by": payload.get("created_by", "system"),
            }
        )
        return template_id
```

---

## 11.3 Strategy 层

### `services/strategy/base.py`

```python
from typing import Protocol


class ArticleGenerationStrategy(Protocol):
    async def generate(self, context: dict) -> dict:
        ...
```

### `services/strategy/single_pass.py`

```python
from article_studio.models.types import ArticleGenerateRequest


class SinglePassStrategy:
    def __init__(self, model_factory, prompt_render_service):
        self.model_factory = model_factory
        self.prompt_render_service = prompt_render_service

    async def generate(self, context: dict) -> dict:
        model = self.model_factory.create(context["model_name"])
        user_prompt = self.prompt_render_service.render(
            context["user_prompt_template"],
            context["input_params"],
        )

        result = await model.generate(
            ArticleGenerateRequest(
                system_prompt=context.get("system_prompt"),
                user_prompt=user_prompt,
                temperature=0.7,
                max_tokens=4000,
            )
        )

        return {
            "title": context["title"],
            "contentMarkdown": result.text,
            "contentText": result.text,
            "summary": None,
            "keywords": [],
        }
```

### `services/strategy/outline_then_write.py`

```python
from article_studio.models.types import ArticleGenerateRequest


class OutlineThenWriteStrategy:
    def __init__(self, model_factory, prompt_render_service):
        self.model_factory = model_factory
        self.prompt_render_service = prompt_render_service

    async def generate(self, context: dict) -> dict:
        model = self.model_factory.create(context["model_name"])

        seed_prompt = self.prompt_render_service.render(
            context["user_prompt_template"],
            context["input_params"],
        )

        outline_resp = await model.generate(
            ArticleGenerateRequest(
                system_prompt="你是一名中文内容策划。先给出层次清晰的文章提纲。",
                user_prompt=seed_prompt,
                temperature=0.5,
                max_tokens=1200,
            )
        )

        article_resp = await model.generate(
            ArticleGenerateRequest(
                system_prompt=context.get("system_prompt"),
                user_prompt=f"根据以下提纲输出完整文章，要求语言完整、结构自然：\n\n{outline_resp.text}",
                temperature=0.7,
                max_tokens=5000,
            )
        )

        return {
            "title": context["title"],
            "contentMarkdown": article_resp.text,
            "contentText": article_resp.text,
            "summary": None,
            "keywords": [],
        }
```

### `services/strategy/registry.py`

```python
from article_studio.services.strategy.single_pass import SinglePassStrategy
from article_studio.services.strategy.outline_then_write import OutlineThenWriteStrategy


class StrategyRegistry:
    def __init__(self, model_factory, prompt_render_service):
        self._strategies = {
            "single_pass": SinglePassStrategy(model_factory, prompt_render_service),
            "outline_then_write": OutlineThenWriteStrategy(model_factory, prompt_render_service),
        }

    def get(self, name: str):
        if name not in self._strategies:
            raise ValueError(f"Unsupported generation mode: {name}")
        return self._strategies[name]
```

---

## 11.4 Model Factory Adapter

### `integrations/model_factory_adapter.py`

```python
from article_studio.models.loader import get_article_model_factory


class ArticleModelFactoryAdapter:
    def __init__(self):
        self.factory = get_article_model_factory()

    def create(self, model_name: str):
        return self.factory.create(model_name)
```

---

## 11.5 ArticleGenerationService

### `services/article_generation_service.py`

```python
from article_studio.repositories.template_repository import TemplateRepository
from article_studio.repositories.template_version_repository import TemplateVersionRepository
from article_studio.repositories.job_repository import JobRepository
from article_studio.repositories.document_repository import DocumentRepository
from article_studio.services.prompt_render_service import PromptRenderService
from article_studio.services.strategy.registry import StrategyRegistry
from article_studio.integrations.model_factory_adapter import ArticleModelFactoryAdapter


class ArticleGenerationService:
    def __init__(self):
        self.template_repo = TemplateRepository()
        self.template_version_repo = TemplateVersionRepository()
        self.job_repo = JobRepository()
        self.document_repo = DocumentRepository()
        self.prompt_render_service = PromptRenderService()
        self.model_factory = ArticleModelFactoryAdapter()
        self.strategy_registry = StrategyRegistry(
            self.model_factory,
            self.prompt_render_service,
        )

    async def execute_job(self, job: dict) -> str:
        template = await self.template_repo.get(job["templateId"])
        if not template:
            raise ValueError("Template not found.")

        template_version = await self.template_version_repo.get_current_version(job["templateId"])
        if not template_version:
            raise ValueError("Template version not found.")

        generation_mode = job.get("generationMode") or template_version["defaultGenerationMode"]
        model_name = job.get("modelName") or template_version["defaultModelName"]

        strategy = self.strategy_registry.get(generation_mode)
        result = await strategy.generate(
            {
                "title": job["title"],
                "input_params": job["inputParams"],
                "model_name": model_name,
                "system_prompt": template_version.get("systemPrompt"),
                "user_prompt_template": job.get("promptOverride") or template_version["userPromptTemplate"],
            }
        )

        document_id = await self.document_repo.create(
            {
                "jobId": str(job["_id"]),
                "templateId": str(template["_id"]),
                "templateVersionId": str(template_version["_id"]),
                "title": result["title"],
                "contentMarkdown": result["contentMarkdown"],
                "contentText": result["contentText"],
                "summary": result["summary"],
                "keywords": result["keywords"],
                "metadata": {
                    "generationMode": generation_mode,
                    "modelName": model_name,
                    "sourceType": "article_studio",
                },
                "createdBy": job["userId"],
            }
        )

        await self.job_repo.mark_succeeded(str(job["_id"]), document_id)
        return document_id
```

---

## 11.6 ApprovalService

### `services/approval_service.py`

```python
from article_studio.repositories.document_repository import DocumentRepository
from article_studio.repositories.approval_repository import ApprovalRepository
from article_studio.repositories.ragflow_task_repository import RagflowTaskRepository


class ApprovalService:
    def __init__(self):
        self.document_repo = DocumentRepository()
        self.approval_repo = ApprovalRepository()
        self.ragflow_task_repo = RagflowTaskRepository()

    async def submit_for_approval(self, document_id: str, comment: str | None) -> None:
        document = await self.document_repo.get(document_id)
        if not document:
            raise ValueError("Document not found.")
        if document["approvalStatus"] != "draft":
            raise ValueError("Only draft document can be submitted for approval.")

        await self.document_repo.submit_for_approval(document_id)
        await self.approval_repo.create(
            {
                "documentId": document_id,
                "status": "submitted",
                "comment": comment,
            }
        )

    async def approve(
        self,
        document_id: str,
        approver_id: str,
        comment: str | None,
        knowledgebase_id: str,
        dataset_id: str | None,
    ) -> None:
        document = await self.document_repo.get(document_id)
        if not document:
            raise ValueError("Document not found.")
        if document["approvalStatus"] != "pending_approval":
            raise ValueError("Only pending_approval document can be approved.")
        if document["ragflowStatus"] == "indexed":
            return

        await self.document_repo.mark_approved(document_id, knowledgebase_id)
        await self.approval_repo.create(
            {
                "documentId": document_id,
                "status": "approved",
                "approverId": approver_id,
                "comment": comment,
            }
        )

        await self.ragflow_task_repo.create(
            {
                "documentId": document_id,
                "documentVersion": document["version"],
                "knowledgebaseId": knowledgebase_id,
                "datasetId": dataset_id,
                "payload": {
                    "title": document["title"],
                    "contentMarkdown": document["contentMarkdown"],
                },
            }
        )

    async def reject(self, document_id: str, approver_id: str, comment: str) -> None:
        document = await self.document_repo.get(document_id)
        if not document:
            raise ValueError("Document not found.")
        if document["approvalStatus"] != "pending_approval":
            raise ValueError("Only pending_approval document can be rejected.")

        await self.document_repo.mark_rejected(document_id)
        await self.approval_repo.create(
            {
                "documentId": document_id,
                "status": "rejected",
                "approverId": approver_id,
                "comment": comment,
            }
        )
```

---

## 11.7 RagflowClient

RAGFlow 本身是完整 RAG 平台，文档摄取与索引是其核心职责。这里不在本文档里假定某个私有接口细节，但必须留出明确 Adapter。

### `integrations/ragflow_client.py`

```python
import httpx
from article_studio.settings.ragflow_settings import RagflowSettings


class RagflowClient:
    def __init__(self):
        self.settings = RagflowSettings()

    async def upload_document(
        self,
        *,
        knowledgebase_id: str,
        dataset_id: str | None,
        title: str,
        markdown_content: str,
        metadata: dict,
    ) -> dict:
        # TODO:
        # 1. 替换为实际 RAGFlow 文档摄取 API
        # 2. 根据实际 API 格式上传 markdown 内容
        # 3. 回传 external_document_id
        #
        # 当前返回占位结构，供其他层先打通
        async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
            return {
                "external_document_id": "ragflow_doc_placeholder",
                "status": "accepted",
            }
```

---

## 11.8 RagflowIngestionService

### `services/ragflow_ingestion_service.py`

```python
from article_studio.integrations.ragflow_client import RagflowClient
from article_studio.repositories.document_repository import DocumentRepository
from article_studio.repositories.ragflow_task_repository import RagflowTaskRepository


class RagflowIngestionService:
    def __init__(self):
        self.ragflow_client = RagflowClient()
        self.document_repo = DocumentRepository()
        self.task_repo = RagflowTaskRepository()

    async def execute_task(self, task: dict) -> None:
        document = await self.document_repo.get(task["documentId"])
        if not document:
            raise ValueError("Document not found.")
        if document["approvalStatus"] != "approved":
            raise ValueError("Only approved document can be indexed.")
        if document["ragflowStatus"] == "indexed":
            await self.task_repo.mark_succeeded(str(task["_id"]))
            return

        await self.document_repo.mark_ragflow_status(task["documentId"], "indexing")

        result = await self.ragflow_client.upload_document(
            knowledgebase_id=task["knowledgebaseId"],
            dataset_id=task.get("datasetId"),
            title=document["title"],
            markdown_content=document["contentMarkdown"],
            metadata={
                "source_type": "article_studio",
                "document_id": task["documentId"],
                "template_id": document["templateId"],
                "generation_mode": document["metadata"]["generationMode"],
                "model_name": document["metadata"]["modelName"],
            },
        )

        await self.document_repo.mark_ragflow_status(
            task["documentId"],
            "indexed",
            ragflow_document_id=result["external_document_id"],
        )
        await self.task_repo.mark_succeeded(str(task["_id"]))
```

---

# 12. FastAPI 路由文件

## 12.1 API App

### `api/app.py`

```python
from fastapi import FastAPI

from article_studio.api.router_health import router as health_router
from article_studio.api.router_templates import router as templates_router
from article_studio.api.router_jobs import router as jobs_router
from article_studio.api.router_documents import router as documents_router
from article_studio.db.indexes import ensure_indexes


def create_app() -> FastAPI:
    app = FastAPI(title="Article Studio API")

    @app.on_event("startup")
    async def startup():
        await ensure_indexes()

    app.include_router(health_router)
    app.include_router(templates_router)
    app.include_router(jobs_router)
    app.include_router(documents_router)
    return app


app = create_app()
```

## 12.2 Health Router

### `api/router_health.py`

```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"ok": True}
```

## 12.3 Templates Router

### `api/router_templates.py`

```python
from fastapi import APIRouter, HTTPException

from article_studio.models.dto.template_dto import (
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateVersionCreateRequest,
)
from article_studio.services.template_service import TemplateService
from article_studio.repositories.template_repository import TemplateRepository
from article_studio.repositories.template_version_repository import TemplateVersionRepository

router = APIRouter(prefix="/api/article-studio/templates", tags=["article-studio-templates"])


@router.post("")
async def create_template(req: TemplateCreateRequest):
    service = TemplateService()
    template_id = await service.create_template(req.model_dump())
    return {"id": template_id}


@router.get("")
async def list_templates():
    repo = TemplateRepository()
    items = await repo.list(limit=100)
    return [
        {
            "id": str(item["_id"]),
            "code": item["code"],
            "name": item["name"],
            "description": item.get("description"),
            "category": item["category"],
            "status": item["status"],
            "current_version": item["currentVersion"],
            "default_model_name": item["defaultModelName"],
            "default_generation_mode": item["defaultGenerationMode"],
            "tags": item.get("tags", []),
        }
        for item in items
    ]


@router.get("/{template_id}")
async def get_template(template_id: str):
    repo = TemplateRepository()
    template = await repo.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return {
        "id": str(template["_id"]),
        "code": template["code"],
        "name": template["name"],
        "description": template.get("description"),
        "category": template["category"],
        "status": template["status"],
        "current_version": template["currentVersion"],
        "default_model_name": template["defaultModelName"],
        "default_generation_mode": template["defaultGenerationMode"],
        "tags": template.get("tags", []),
    }


@router.put("/{template_id}")
async def update_template(template_id: str, req: TemplateUpdateRequest):
    repo = TemplateRepository()
    patch = {k: v for k, v in req.model_dump().items() if v is not None}
    await repo.update(template_id, patch)
    return {"ok": True}


@router.post("/{template_id}/versions")
async def create_template_version(template_id: str, req: TemplateVersionCreateRequest):
    template_repo = TemplateRepository()
    version_repo = TemplateVersionRepository()

    template = await template_repo.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    next_version = int(template["currentVersion"]) + 1
    version_id = await version_repo.create(
        {
            "templateId": template_id,
            "version": next_version,
            "schema": req.schema,
            "system_prompt": req.system_prompt,
            "user_prompt_template": req.user_prompt_template,
            "default_model_name": req.default_model_name,
            "default_generation_mode": req.default_generation_mode,
            "example_input": req.example_input,
            "example_output": req.example_output,
        }
    )
    await template_repo.set_current_version(template_id, next_version)
    return {"id": version_id, "version": next_version}
```

## 12.4 Jobs Router

### `api/router_jobs.py`

```python
from fastapi import APIRouter, HTTPException

from article_studio.models.dto.job_dto import JobCreateRequest
from article_studio.repositories.job_repository import JobRepository

router = APIRouter(prefix="/api/article-studio/jobs", tags=["article-studio-jobs"])


@router.post("")
async def create_job(req: JobCreateRequest):
    repo = JobRepository()
    job_id = await repo.create(
        {
            "templateId": req.template_id,
            "title": req.title,
            "inputParams": req.input_params,
            "generationMode": req.generation_mode,
            "modelName": req.model_name,
            "promptOverride": req.prompt_override,
            "userId": "mock-user",
        }
    )
    return {
        "id": job_id,
        "status": "queued",
        "document_id": None,
    }


@router.get("/{job_id}")
async def get_job(job_id: str):
    repo = JobRepository()
    job = await repo.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": str(job["_id"]),
        "status": job["status"],
        "document_id": job.get("documentId"),
        "last_error": job.get("lastError"),
    }


@router.post("/{job_id}/retry")
async def retry_job(job_id: str):
    repo = JobRepository()
    job = await repo.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "failed":
        raise HTTPException(status_code=400, detail="Only failed job can be retried")

    await repo.requeue(job_id)
    return {"ok": True}
```

## 12.5 Documents Router

### `api/router_documents.py`

```python
from fastapi import APIRouter, HTTPException

from article_studio.models.dto.document_dto import (
    DocumentUpdateRequest,
    SubmitApprovalRequest,
    ApproveDocumentRequest,
    RejectDocumentRequest,
)
from article_studio.repositories.document_repository import DocumentRepository
from article_studio.repositories.ragflow_task_repository import RagflowTaskRepository
from article_studio.services.approval_service import ApprovalService

router = APIRouter(prefix="/api/article-studio/documents", tags=["article-studio-documents"])


@router.get("/{document_id}")
async def get_document(document_id: str):
    repo = DocumentRepository()
    document = await repo.get(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": str(document["_id"]),
        "title": document["title"],
        "content_markdown": document["contentMarkdown"],
        "summary": document.get("summary"),
        "keywords": document.get("keywords", []),
        "approval_status": document["approvalStatus"],
        "ragflow_status": document["ragflowStatus"],
        "version": document["version"],
    }


@router.put("/{document_id}")
async def update_document(document_id: str, req: DocumentUpdateRequest):
    repo = DocumentRepository()
    doc = await repo.get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["approvalStatus"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft document can be edited")

    patch = {
        "contentMarkdown": req.content_markdown,
        "contentText": req.content_markdown,
    }
    if req.title is not None:
        patch["title"] = req.title
    if req.summary is not None:
        patch["summary"] = req.summary
    if req.keywords is not None:
        patch["keywords"] = req.keywords

    await repo.update_draft(document_id, patch)
    return {"ok": True}


@router.post("/{document_id}/submit-approval")
async def submit_approval(document_id: str, req: SubmitApprovalRequest):
    service = ApprovalService()
    await service.submit_for_approval(document_id, req.comment)
    return {"ok": True}


@router.post("/{document_id}/approve")
async def approve_document(document_id: str, req: ApproveDocumentRequest):
    service = ApprovalService()
    await service.approve(
        document_id=document_id,
        approver_id="mock-approver",
        comment=req.comment,
        knowledgebase_id=req.knowledgebase_id,
        dataset_id=req.dataset_id,
    )
    return {"ok": True}


@router.post("/{document_id}/reject")
async def reject_document(document_id: str, req: RejectDocumentRequest):
    service = ApprovalService()
    await service.reject(
        document_id=document_id,
        approver_id="mock-approver",
        comment=req.comment,
    )
    return {"ok": True}


@router.get("/{document_id}/ragflow-status")
async def get_ragflow_status(document_id: str):
    repo = DocumentRepository()
    document = await repo.get(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "document_id": document_id,
        "ragflow_status": document["ragflowStatus"],
        "ragflow_document_id": document.get("ragflowDocumentId"),
        "knowledgebase_id": document.get("ragflowKnowledgebaseId"),
    }


@router.post("/{document_id}/ragflow-retry")
async def retry_ragflow(document_id: str):
    doc_repo = DocumentRepository()
    task_repo = RagflowTaskRepository()

    document = await doc_repo.get(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document["approvalStatus"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved document can retry ragflow ingestion")

    # 这里按当前版本重建队列任务；如已有唯一索引冲突，由后续实现改为 upsert/requeue
    await task_repo.create(
        {
            "documentId": document_id,
            "documentVersion": document["version"],
            "knowledgebaseId": document["ragflowKnowledgebaseId"],
            "datasetId": None,
            "payload": {
                "title": document["title"],
                "contentMarkdown": document["contentMarkdown"],
            },
        }
    )
    await doc_repo.mark_ragflow_status(document_id, "queued")
    return {"ok": True}
```

---

# 13. Worker 代码骨架

## 13.1 GenerationWorker

### `workers/generation_worker.py`

```python
import asyncio
import logging

from article_studio.repositories.job_repository import JobRepository
from article_studio.services.article_generation_service import ArticleGenerationService
from article_studio.settings.article_studio_settings import ArticleStudioSettings

logger = logging.getLogger(__name__)


class GenerationWorker:
    def __init__(self):
        settings = ArticleStudioSettings()
        self.poll_interval_seconds = settings.worker_poll_seconds
        self.job_repo = JobRepository()
        self.generation_service = ArticleGenerationService()
        self._running = False

    async def run_forever(self):
        self._running = True
        logger.info("GenerationWorker started.")

        while self._running:
            job = await self.job_repo.claim_next_queued_job()
            if not job:
                await asyncio.sleep(self.poll_interval_seconds)
                continue

            try:
                await self.generation_service.execute_job(job)
            except Exception as exc:
                logger.exception("Generation job failed: %s", exc)
                await self.job_repo.mark_failed(str(job["_id"]), str(exc))

    def stop(self):
        self._running = False
```

## 13.2 RAGFlow Ingestion Worker

### `workers/ragflow_ingestion_worker.py`

```python
import asyncio
import logging

from article_studio.repositories.ragflow_task_repository import RagflowTaskRepository
from article_studio.repositories.document_repository import DocumentRepository
from article_studio.services.ragflow_ingestion_service import RagflowIngestionService
from article_studio.settings.article_studio_settings import ArticleStudioSettings

logger = logging.getLogger(__name__)


class RagflowIngestionWorker:
    def __init__(self):
        settings = ArticleStudioSettings()
        self.poll_interval_seconds = settings.ragflow_worker_poll_seconds
        self.task_repo = RagflowTaskRepository()
        self.document_repo = DocumentRepository()
        self.service = RagflowIngestionService()
        self._running = False

    async def run_forever(self):
        self._running = True
        logger.info("RagflowIngestionWorker started.")

        while self._running:
            task = await self.task_repo.claim_next_queued_task()
            if not task:
                await asyncio.sleep(self.poll_interval_seconds)
                continue

            try:
                await self.service.execute_task(task)
            except Exception as exc:
                logger.exception("RAGFlow ingestion failed: %s", exc)
                await self.document_repo.mark_ragflow_status(task["documentId"], "failed")
                await self.task_repo.mark_failed(str(task["_id"]), str(exc))

    def stop(self):
        self._running = False
```

---

# 14. Worker 启动入口

## 14.1 Generation Worker 入口

### `workers/run_generation_worker.py`

```python
import asyncio
import logging

from article_studio.db.indexes import ensure_indexes
from article_studio.workers.generation_worker import GenerationWorker

logging.basicConfig(level=logging.INFO)


async def main():
    await ensure_indexes()
    worker = GenerationWorker()
    await worker.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
```

## 14.2 RAGFlow Worker 入口

### `workers/run_ragflow_worker.py`

```python
import asyncio
import logging

from article_studio.db.indexes import ensure_indexes
from article_studio.workers.ragflow_ingestion_worker import RagflowIngestionWorker

logging.basicConfig(level=logging.INFO)


async def main():
    await ensure_indexes()
    worker = RagflowIngestionWorker()
    await worker.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
```

---

# 15. FastAPI 启动入口

## 15.1 本地运行命令

```bash
uvicorn article_studio.api.app:app --host 0.0.0.0 --port 8320 --reload
```

## 15.2 Worker 运行命令

```bash
python -m article_studio.workers.run_generation_worker
python -m article_studio.workers.run_ragflow_worker
```

---

# 16. Cursor 编码要求

## 16.1 必须完成

* 上述目录与文件全部生成
* 所有 import 路径可运行
* 所有 DTO、Repository、Service、Worker 有类型标注
* 所有时间字段使用 UTC
* 所有 Mongo `_id` 返回给 API 时转为字符串
* 所有路由具备基础 404 / 400 处理

## 16.2 第一版允许留空

* `RagflowClient.upload_document()` 的实际 HTTP 契约细节
  但必须保留统一 Adapter 接口与 TODO。

## 16.3 不允许擅自修改

* 集合命名
* 状态枚举
* 目录边界
* Worker 拆分方式
* 独立 Model Factory 的对接模式

---

# 17. 测试要求

## 17.1 最低测试覆盖

* 创建模板
* 创建模板版本
* 创建生文任务
* Generation Worker 拉取 queued job 并生成 document
* 草稿提交审批
* 审批通过后创建 ragflow task
* Ragflow Worker 拉取 queued task 并回写 indexed

## 17.2 必测异常

* 模板不存在
* job 重试非法状态
* document 在非 draft 状态下编辑
* 非 approved 文档触发 RAGFlow 入库
* Worker 执行异常后状态落 `failed`

---

# 18. RAGFlow 集成详细说明

## 18.1 RAGFlow API 接口规范

### 18.1.1 文档上传接口

```python
# RAGFlow 文档上传 API 规范
POST /api/v1/knowledgebases/{knowledgebase_id}/documents
Headers:
  - Authorization: Bearer {api_key}
  - Content-Type: application/json

Request Body:
{
  "title": "文档标题",
  "content": "Markdown 格式的文档内容",
  "metadata": {
    "source_type": "article_studio",
    "document_id": "MongoDB 文档 ID",
    "template_id": "模板 ID",
    "generation_mode": "single_pass | outline_then_write",
    "model_name": "使用的模型名称"
  }
}

Response:
{
  "document_id": "RAGFlow 返回的文档 ID",
  "status": "accepted | processing | failed",
  "message": "处理状态说明"
}
```

### 18.1.2 文档状态查询接口

```python
GET /api/v1/knowledgebases/{knowledgebase_id}/documents/{document_id}
Headers:
  - Authorization: Bearer {api_key}

Response:
{
  "document_id": "文档 ID",
  "status": "indexed | processing | failed",
  "indexed_at": "2024-01-01T00:00:00Z",
  "error": "错误信息(如果有)"
}
```

## 18.2 RAGFlow 集成错误处理

### 18.2.1 重试策略

```python
# RagflowClient 错误处理策略
class RagflowRetryStrategy:
    max_retries: int = 3
    retry_delay_seconds: int = 5
    retryable_status_codes: list[int] = [429, 500, 502, 503, 504]

    async def execute_with_retry(self, operation):
        for attempt in range(self.max_retries):
            try:
                return await operation()
            except httpx.HTTPStatusError as e:
                if e.response.status_code in self.retryable_status_codes:
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self.retry_delay_seconds * (attempt + 1))
                        continue
                raise
```

### 18.2.2 错误分类

- **临时性错误**: 网络超时、服务不可用 (429, 503) → 自动重试
- **永久性错误**: 认证失败 (401)、权限不足 (403)、资源不存在 (404) → 标记失败,不重试
- **业务错误**: 文档格式错误、内容过大 → 记录错误,人工介入

## 18.3 RAGFlow 监控指标

```python
# 需要监控的关键指标
metrics = {
    "ragflow_upload_success_count": "成功上传文档数",
    "ragflow_upload_failure_count": "上传失败文档数",
    "ragflow_upload_latency_seconds": "上传延迟(秒)",
    "ragflow_indexing_duration_seconds": "索引完成耗时(秒)",
    "ragflow_queue_size": "待处理队列大小",
    "ragflow_worker_health": "Worker 健康状态",
}
```

---

# 19. ArticleModelFactory 实现规范

## 19.1 配置文件格式

### `article-models.yaml`

```yaml
# Article Studio 独立模型配置
models:
  - name: gpt-4o
    display_name: GPT-4o
    use: langchain_openai:ChatOpenAI
    model: gpt-4o
    api_key: $OPENAI_API_KEY
    temperature: 0.7
    max_tokens: 4000
    supports_vision: true
    supports_streaming: true

  - name: claude-3-sonnet
    display_name: Claude 3 Sonnet
    use: langchain_anthropic:ChatAnthropic
    model: claude-3-sonnet-20240229
    api_key: $ANTHROPIC_API_KEY
    temperature: 0.7
    max_tokens: 4000

  - name: deepseek-chat
    display_name: DeepSeek Chat
    use: langchain_openai:ChatOpenAI
    model: deepseek-chat
    api_base: https://api.deepseek.com/v1
    api_key: $DEEPSEEK_API_KEY
    temperature: 0.7
    max_tokens: 4000
```

## 19.2 Model Factory 实现

### `models/loader.py`

```python
import yaml
from pathlib import Path
from typing import Any
from functools import lru_cache


class ArticleModelFactory:
    """独立的模型工厂,不依赖 DeerFlow 的 create_chat_model()"""

    def __init__(self, config_path: str):
        self.config_path = Path(config_path)
        self._models: dict[str, dict[str, Any]] = {}
        self._load_config()

    def _load_config(self) -> None:
        """加载 article-models.yaml 配置"""
        if not self.config_path.exists():
            raise FileNotFoundError(f"Model config not found: {self.config_path}")

        with open(self.config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        for model_config in config.get("models", []):
            self._models[model_config["name"]] = model_config

    def create(self, model_name: str):
        """创建模型实例"""
        if model_name not in self._models:
            raise ValueError(f"Model not found: {model_name}")

        config = self._models[model_name]
        use_path = config["use"]

        # 动态导入模型类
        module_path, class_name = use_path.rsplit(":", 1)
        module = __import__(module_path, fromlist=[class_name])
        model_class = getattr(module, class_name)

        # 构建模型参数
        model_params = {
            "model": config["model"],
            "temperature": config.get("temperature", 0.7),
            "max_tokens": config.get("max_tokens", 4000),
        }

        # 添加 API 配置
        if "api_key" in config:
            model_params["api_key"] = config["api_key"]
        if "api_base" in config:
            model_params["base_url"] = config["api_base"]

        return model_class(**model_params)

    def list_models(self) -> list[dict[str, Any]]:
        """列出所有可用模型"""
        return [
            {
                "name": name,
                "display_name": config.get("display_name", name),
                "supports_vision": config.get("supports_vision", False),
                "supports_streaming": config.get("supports_streaming", True),
            }
            for name, config in self._models.items()
        ]


@lru_cache(maxsize=1)
def get_article_model_factory() -> ArticleModelFactory:
    """获取单例 Model Factory"""
    import os
    config_path = os.getenv(
        "ARTICLE_STUDIO_MODEL_CONFIG_PATH",
        "./article-models.yaml"
    )
    return ArticleModelFactory(config_path)
```

## 19.3 模型调用适配器

### `models/types.py`

```python
from pydantic import BaseModel
from typing import Any


class ArticleGenerateRequest(BaseModel):
    """文章生成请求"""
    system_prompt: str | None = None
    user_prompt: str
    temperature: float = 0.7
    max_tokens: int = 4000
    metadata: dict[str, Any] = {}


class ArticleGenerateResponse(BaseModel):
    """文章生成响应"""
    text: str
    usage: dict[str, int] = {}
    metadata: dict[str, Any] = {}
```

---

# 20. 审批流程详细设计

## 20.1 审批状态流转

```
┌─────────┐
│  draft  │ (草稿状态)
└────┬────┘
     │ submit_for_approval()
     ▼
┌──────────────────┐
│ pending_approval │ (待审批)
└────┬─────┬───────┘
     │     │
     │     └──────────┐
     │                │
     ▼                ▼
┌──────────┐    ┌──────────┐
│ approved │    │ rejected │
└────┬─────┘    └──────────┘
     │
     │ RAGFlow Ingestion
     ▼
┌─────────┐
│ indexed │ (已入库)
└─────────┘
```

## 20.2 审批权限设计

### 20.2.1 角色定义

```python
# 审批角色
ROLE_ADMIN = "admin"           # 管理员: 所有权限
ROLE_EDITOR = "editor"         # 编辑: 创建、编辑草稿
ROLE_APPROVER = "approver"     # 审批人: 审批通过/拒绝
ROLE_VIEWER = "viewer"         # 查看者: 只读权限
```

### 20.2.2 权限矩阵

| 操作 | admin | editor | approver | viewer |
|------|-------|--------|----------|--------|
| 创建模板 | ✅ | ✅ | ❌ | ❌ |
| 编辑草稿 | ✅ | ✅ | ❌ | ❌ |
| 提交审批 | ✅ | ✅ | ❌ | ❌ |
| 审批通过 | ✅ | ❌ | ✅ | ❌ |
| 审批拒绝 | ✅ | ❌ | ✅ | ❌ |
| 查看文档 | ✅ | ✅ | ✅ | ✅ |

## 20.3 审批历史记录

### `models/persistence/approval_doc.py`

```python
# 审批记录文档结构
{
    "_id": ObjectId,
    "documentId": "文档 ID",
    "status": "submitted | approved | rejected",
    "approverId": "审批人 ID",
    "comment": "审批意见",
    "previousStatus": "上一个状态",
    "metadata": {
        "ip_address": "审批人 IP",
        "user_agent": "用户代理",
        "approved_at": "审批时间"
    },
    "createdAt": "创建时间"
}
```

## 20.4 审批通知机制

```python
# 审批通知接口
class ApprovalNotifier:
    async def notify_submitted(self, document_id: str, submitter_id: str) -> None:
        """通知审批人有新文档待审批"""
        pass

    async def notify_approved(self, document_id: str, approver_id: str) -> None:
        """通知提交人文档已通过"""
        pass

    async def notify_rejected(self, document_id: str, approver_id: str, reason: str) -> None:
        """通知提交人文档被拒绝"""
        pass
```

---

# 21. 错误处理和监控机制

## 21.1 错误分类和处理

### 21.1.1 错误类型定义

```python
from enum import Enum


class ErrorType(Enum):
    # 业务错误
    TEMPLATE_NOT_FOUND = "template_not_found"
    DOCUMENT_NOT_FOUND = "document_not_found"
    INVALID_STATUS_TRANSITION = "invalid_status_transition"
    PERMISSION_DENIED = "permission_denied"

    # 系统错误
    DATABASE_ERROR = "database_error"
    MODEL_ERROR = "model_error"
    RAGFLOW_ERROR = "ragflow_error"
    NETWORK_ERROR = "network_error"

    # 临时错误
    RATE_LIMIT = "rate_limit"
    SERVICE_UNAVAILABLE = "service_unavailable"
```

### 21.1.2 错误处理策略

```python
class ErrorHandler:
    async def handle(self, error: Exception, context: dict) -> None:
        """统一错误处理"""
        error_type = self._classify_error(error)

        if error_type in [ErrorType.RATE_LIMIT, ErrorType.SERVICE_UNAVAILABLE]:
            # 临时错误: 重试
            await self._retry_operation(context)
        elif error_type in [ErrorType.DATABASE_ERROR, ErrorType.MODEL_ERROR]:
            # 系统错误: 记录并告警
            await self._log_and_alert(error, context)
        else:
            # 业务错误: 记录并返回
            await self._log_error(error, context)
```

## 21.2 监控指标

### 21.2.1 业务指标

```python
business_metrics = {
    # 文章生成
    "article_generation_total": "总生成数",
    "article_generation_success": "成功生成数",
    "article_generation_failure": "失败生成数",
    "article_generation_duration_seconds": "生成耗时",

    # 审批流程
    "approval_submitted_total": "提交审批数",
    "approval_approved_total": "审批通过数",
    "approval_rejected_total": "审批拒绝数",
    "approval_pending_count": "待审批数量",

    # RAGFlow 入库
    "ragflow_ingestion_total": "总入库数",
    "ragflow_ingestion_success": "成功入库数",
    "ragflow_ingestion_failure": "失败入库数",
    "ragflow_queue_size": "队列大小",
}
```

### 21.2.2 系统指标

```python
system_metrics = {
    # MongoDB
    "mongo_connection_pool_size": "连接池大小",
    "mongo_operation_duration_seconds": "操作耗时",
    "mongo_error_count": "错误数",

    # API
    "api_request_total": "总请求数",
    "api_request_duration_seconds": "请求耗时",
    "api_error_count": "错误数",

    # Worker
    "worker_job_processed_total": "处理任务数",
    "worker_queue_size": "队列大小",
    "worker_health_status": "健康状态",
}
```

## 21.3 日志规范

```python
import structlog


# 结构化日志配置
logger = structlog.get_logger()

# 日志格式
{
    "timestamp": "2024-01-01T00:00:00Z",
    "level": "info",
    "event": "article_generation_started",
    "job_id": "xxx",
    "template_id": "xxx",
    "user_id": "xxx",
    "metadata": {}
}
```

## 21.4 告警规则

```yaml
# 告警规则配置
alerts:
  - name: high_error_rate
    condition: "error_rate > 5%"
    duration: 5m
    severity: critical
    notification:
      - email
      - slack

  - name: worker_down
    condition: "worker_health_status == 0"
    duration: 1m
    severity: critical
    notification:
      - pagerduty

  - name: queue_backlog
    condition: "queue_size > 100"
    duration: 10m
    severity: warning
    notification:
      - slack
```

---

# 22. 测试策略详细说明

## 22.1 单元测试

### 22.1.1 Repository 层测试

```python
import pytest
from article_studio.repositories.template_repository import TemplateRepository


@pytest.mark.asyncio
async def test_template_repository_create():
    repo = TemplateRepository()
    template_id = await repo.create({
        "code": "test_template",
        "name": "Test Template",
        "category": "test",
        "default_model_name": "gpt-4o",
        "default_generation_mode": "single_pass",
    })

    assert template_id is not None
    template = await repo.get(template_id)
    assert template["code"] == "test_template"
```

### 22.1.2 Service 层测试

```python
@pytest.mark.asyncio
async def test_article_generation_service():
    service = ArticleGenerationService()
    job = {
        "_id": "test_job_id",
        "templateId": "test_template_id",
        "title": "Test Article",
        "inputParams": {"topic": "AI"},
        "userId": "test_user",
    }

    document_id = await service.execute_job(job)
    assert document_id is not None
```

## 22.2 集成测试

### 22.2.1 API 端点测试

```python
from fastapi.testclient import TestClient
from article_studio.api.app import app


client = TestClient(app)


def test_create_template():
    response = client.post("/api/article-studio/templates", json={
        "code": "test_template",
        "name": "Test Template",
        "category": "test",
        "schema": {},
        "user_prompt_template": "Write about {{topic}}",
        "default_model_name": "gpt-4o",
        "default_generation_mode": "single_pass",
    })

    assert response.status_code == 200
    assert "id" in response.json()
```

### 22.2.2 Worker 流程测试

```python
@pytest.mark.asyncio
async def test_generation_worker_flow():
    # 1. 创建模板
    # 2. 创建任务
    # 3. 启动 Worker
    # 4. 验证文档生成
    # 5. 验证状态更新
    pass
```

## 22.3 E2E 测试

### 22.3.1 完整流程测试

```python
@pytest.mark.e2e
async def test_full_article_workflow():
    """测试完整的文章生成和审批流程"""
    # 1. 创建模板
    template_id = await create_template()

    # 2. 创建生成任务
    job_id = await create_job(template_id)

    # 3. 等待生成完成
    document_id = await wait_for_completion(job_id)

    # 4. 提交审批
    await submit_for_approval(document_id)

    # 5. 审批通过
    await approve_document(document_id)

    # 6. 等待 RAGFlow 入库
    await wait_for_ragflow_indexing(document_id)

    # 7. 验证最终状态
    document = await get_document(document_id)
    assert document["approvalStatus"] == "approved"
    assert document["ragflowStatus"] == "indexed"
```

## 22.4 测试覆盖率要求

```yaml
# pytest.ini
[pytest]
minversion = 8.0
addopts =
    --cov=article_studio
    --cov-report=term-missing
    --cov-report=html
    --cov-fail-under=80

# 覆盖率要求
coverage:
  repository: 90%
  service: 85%
  api: 80%
  worker: 75%
```

---

# 23. 部署和运维

## 23.1 Docker 部署

### Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# 安装依赖
COPY pyproject.toml .
RUN pip install uv && uv pip install --system -e .

# 复制代码
COPY article_studio/ ./article_studio/
COPY article-models.yaml .

# 启动命令
CMD ["uvicorn", "article_studio.api.app:app", "--host", "0.0.0.0", "--port", "8320"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8320:8320"
    environment:
      - ARTICLE_STUDIO_MONGODB_URI=mongodb://mongo:27017
      - ARTICLE_STUDIO_MONGODB_DB=article_studio
    depends_on:
      - mongo

  generation-worker:
    build: .
    command: python -m article_studio.workers.run_generation_worker
    environment:
      - ARTICLE_STUDIO_MONGODB_URI=mongodb://mongo:27017
    depends_on:
      - mongo

  ragflow-worker:
    build: .
    command: python -m article_studio.workers.run_ragflow_worker
    environment:
      - ARTICLE_STUDIO_MONGODB_URI=mongodb://mongo:27017
    depends_on:
      - mongo

  mongo:
    image: mongo:7.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## 23.2 Kubernetes 部署

### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: article-studio-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: article-studio-api
  template:
    spec:
      containers:
      - name: api
        image: article-studio:latest
        ports:
        - containerPort: 8320
        env:
        - name: ARTICLE_STUDIO_MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: article-studio-secrets
              key: mongodb-uri
```

---

# 24. 最终落地顺序

## Phase 1

* Mongo Manager
* 集合索引
* Template/Version Repository
* Job/Document/Approval/RagflowTask Repository

## Phase 2

* TemplateService
* ArticleGenerationService
* ApprovalService
* FastAPI 路由

## Phase 3

* Generation Worker
* Ragflow Worker
* 启动脚本
* 最小集成测试

---
