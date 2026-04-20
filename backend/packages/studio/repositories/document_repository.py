from datetime import datetime
from bson import ObjectId
from studio.db.collections import get_collection, COLLECTION_ARTICLE_DOCUMENTS
from studio.models.persistence import (
    APPROVAL_STATUS_DRAFT,
    APPROVAL_STATUS_PENDING,
    APPROVAL_STATUS_APPROVED,
    APPROVAL_STATUS_REJECTED,
    RAGFLOW_STATUS_NOT_INDEXED,
    RAGFLOW_STATUS_QUEUED,
    RAGFLOW_STATUS_INDEXING,
    RAGFLOW_STATUS_INDEXED,
    RAGFLOW_STATUS_FAILED,
)


class DocumentRepository:
    """文档仓储"""

    def __init__(self):
        self.collection = get_collection(COLLECTION_ARTICLE_DOCUMENTS)

    async def create(self, document_data: dict) -> str:
        """创建文档"""
        now = datetime.utcnow()
        document_data["createdAt"] = now
        document_data["updatedAt"] = now
        document_data["version"] = 1
        document_data["approvalStatus"] = APPROVAL_STATUS_DRAFT
        document_data["ragflowStatus"] = RAGFLOW_STATUS_NOT_INDEXED

        result = await self.collection.insert_one(document_data)
        return str(result.inserted_id)

    async def find_by_id(self, document_id: str) -> dict | None:
        """根据 ID 查询文档"""
        if not ObjectId.is_valid(document_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(document_id)})

    async def find_by_job_id(self, job_id: str) -> dict | None:
        """根据任务 ID 查询文档"""
        if not ObjectId.is_valid(job_id):
            return None
        return await self.collection.find_one({"jobId": ObjectId(job_id)})

    async def find_list(
        self,
        template_id: str | None = None,
        approval_status: str | None = None,
        ragflow_status: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        """列表查询文档"""
        query = {}
        if template_id and ObjectId.is_valid(template_id):
            query["templateId"] = ObjectId(template_id)
        if approval_status:
            query["approvalStatus"] = approval_status
        if ragflow_status:
            query["ragflowStatus"] = ragflow_status

        cursor = (
            self.collection.find(query)
            .sort("updatedAt", -1)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def update(self, document_id: str, update_data: dict) -> bool:
        """更新文档"""
        if not ObjectId.is_valid(document_id):
            return False

        update_data["updatedAt"] = datetime.utcnow()
        result = await self.collection.update_one(
            {"_id": ObjectId(document_id)}, {"$set": update_data}
        )
        return result.modified_count > 0

    async def update_content(
        self,
        document_id: str,
        title: str | None,
        content_markdown: str,
        summary: str | None,
        keywords: list[str] | None,
    ) -> bool:
        """更新文档内容"""
        update_data = {"contentMarkdown": content_markdown}
        if title is not None:
            update_data["title"] = title
        if summary is not None:
            update_data["summary"] = summary
        if keywords is not None:
            update_data["keywords"] = keywords

        return await self.update(document_id, update_data)

    async def submit_for_approval(self, document_id: str) -> bool:
        """提交审批"""
        return await self.update(document_id, {"approvalStatus": APPROVAL_STATUS_PENDING})

    async def approve(self, document_id: str) -> bool:
        """审批通过"""
        return await self.update(document_id, {"approvalStatus": APPROVAL_STATUS_APPROVED})

    async def reject(self, document_id: str) -> bool:
        """审批驳回"""
        return await self.update(document_id, {"approvalStatus": APPROVAL_STATUS_REJECTED})

    async def update_ragflow_status(
        self, document_id: str, ragflow_status: str
    ) -> bool:
        """更新 RAGFlow 状态"""
        return await self.update(document_id, {"ragflowStatus": ragflow_status})

    async def set_ragflow_queued(self, document_id: str) -> bool:
        """设置 RAGFlow 状态为排队"""
        return await self.update_ragflow_status(document_id, RAGFLOW_STATUS_QUEUED)

    async def set_ragflow_indexing(self, document_id: str) -> bool:
        """设置 RAGFlow 状态为索引中"""
        return await self.update_ragflow_status(document_id, RAGFLOW_STATUS_INDEXING)

    async def set_ragflow_indexed(self, document_id: str) -> bool:
        """设置 RAGFlow 状态为已索引"""
        return await self.update_ragflow_status(document_id, RAGFLOW_STATUS_INDEXED)

    async def set_ragflow_failed(self, document_id: str) -> bool:
        """设置 RAGFlow 状态为失败"""
        return await self.update_ragflow_status(document_id, RAGFLOW_STATUS_FAILED)

    async def count(
        self,
        template_id: str | None = None,
        approval_status: str | None = None,
        ragflow_status: str | None = None,
    ) -> int:
        """统计文档数量"""
        query = {}
        if template_id and ObjectId.is_valid(template_id):
            query["templateId"] = ObjectId(template_id)
        if approval_status:
            query["approvalStatus"] = approval_status
        if ragflow_status:
            query["ragflowStatus"] = ragflow_status
        return await self.collection.count_documents(query)
