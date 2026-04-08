from datetime import datetime
from bson import ObjectId
from article_studio.db.collections import (
    get_collection,
    COLLECTION_ARTICLE_RAGFLOW_TASKS,
)
from article_studio.models.persistence import (
    RAGFLOW_TASK_STATUS_QUEUED,
    RAGFLOW_TASK_STATUS_INDEXING,
    RAGFLOW_TASK_STATUS_INDEXED,
    RAGFLOW_TASK_STATUS_FAILED,
)


class RagflowTaskRepository:
    """RAGFlow 任务仓储"""

    def __init__(self):
        self.collection = get_collection(COLLECTION_ARTICLE_RAGFLOW_TASKS)

    async def create(self, task_data: dict) -> str:
        """创建 RAGFlow 任务"""
        now = datetime.utcnow()
        task_data["createdAt"] = now
        task_data["updatedAt"] = now
        task_data["status"] = RAGFLOW_TASK_STATUS_QUEUED

        result = await self.collection.insert_one(task_data)
        return str(result.inserted_id)

    async def find_by_id(self, task_id: str) -> dict | None:
        """根据 ID 查询任务"""
        if not ObjectId.is_valid(task_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(task_id)})

    async def find_by_document_and_version(
        self, document_id: str, document_version: int
    ) -> dict | None:
        """根据文档 ID 和版本查询任务"""
        if not ObjectId.is_valid(document_id):
            return None
        return await self.collection.find_one(
            {"documentId": ObjectId(document_id), "documentVersion": document_version}
        )

    async def find_queued_tasks(self, limit: int = 100) -> list[dict]:
        """查询待处理任务"""
        cursor = (
            self.collection.find({"status": RAGFLOW_TASK_STATUS_QUEUED})
            .sort("createdAt", 1)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def update_status(
        self, task_id: str, status: str, extra_data: dict | None = None
    ) -> bool:
        """更新任务状态"""
        if not ObjectId.is_valid(task_id):
            return False

        update_data = {"status": status, "updatedAt": datetime.utcnow()}
        if extra_data:
            update_data.update(extra_data)

        result = await self.collection.update_one(
            {"_id": ObjectId(task_id)}, {"$set": update_data}
        )
        return result.modified_count > 0

    async def set_indexing(self, task_id: str) -> bool:
        """设置任务为索引中"""
        return await self.update_status(task_id, RAGFLOW_TASK_STATUS_INDEXING)

    async def set_indexed(
        self, task_id: str, ragflow_document_id: str
    ) -> bool:
        """设置任务为已索引"""
        return await self.update_status(
            task_id, RAGFLOW_TASK_STATUS_INDEXED, {"ragflowDocumentId": ragflow_document_id}
        )

    async def set_failed(self, task_id: str, error: str) -> bool:
        """设置任务为失败"""
        return await self.update_status(
            task_id, RAGFLOW_TASK_STATUS_FAILED, {"lastError": error}
        )

    async def find_by_document(self, document_id: str) -> list[dict]:
        """查询文档的所有入库任务"""
        if not ObjectId.is_valid(document_id):
            return []

        cursor = self.collection.find(
            {"documentId": ObjectId(document_id)}
        ).sort("createdAt", -1)
        return await cursor.to_list(length=100)

    async def count(self, status: str | None = None) -> int:
        """统计任务数量"""
        query = {}
        if status:
            query["status"] = status
        return await self.collection.count_documents(query)
