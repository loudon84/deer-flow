from datetime import datetime
from bson import ObjectId
from studio.db.collections import get_collection, COLLECTION_ARTICLE_APPROVALS
from studio.models.persistence import (
    APPROVAL_RECORD_STATUS_PENDING,
    APPROVAL_RECORD_STATUS_APPROVED,
    APPROVAL_RECORD_STATUS_REJECTED,
)


class ApprovalRepository:
    """审批仓储"""

    def __init__(self):
        self.collection = get_collection(COLLECTION_ARTICLE_APPROVALS)

    async def create(self, approval_data: dict) -> str:
        """创建审批记录"""
        approval_data["createdAt"] = datetime.utcnow()

        result = await self.collection.insert_one(approval_data)
        return str(result.inserted_id)

    async def find_by_id(self, approval_id: str) -> dict | None:
        """根据 ID 查询审批记录"""
        if not ObjectId.is_valid(approval_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(approval_id)})

    async def find_by_document_id(
        self, document_id: str, skip: int = 0, limit: int = 20
    ) -> list[dict]:
        """查询文档的审批记录"""
        if not ObjectId.is_valid(document_id):
            return []

        cursor = (
            self.collection.find({"documentId": ObjectId(document_id)})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_latest_by_document(self, document_id: str) -> dict | None:
        """查询文档的最新审批记录"""
        if not ObjectId.is_valid(document_id):
            return None

        return await self.collection.find_one(
            {"documentId": ObjectId(document_id)}, sort=[("createdAt", -1)]
        )

    async def create_pending_approval(
        self, document_id: str, approver_id: str, comment: str | None = None
    ) -> str:
        """创建待审批记录"""
        if not ObjectId.is_valid(document_id):
            raise ValueError("Invalid document_id")

        approval_data = {
            "documentId": ObjectId(document_id),
            "approverId": approver_id,
            "status": APPROVAL_RECORD_STATUS_PENDING,
            "comment": comment,
        }
        return await self.create(approval_data)

    async def create_approved(
        self, document_id: str, approver_id: str, comment: str | None = None
    ) -> str:
        """创建已通过审批记录"""
        if not ObjectId.is_valid(document_id):
            raise ValueError("Invalid document_id")

        approval_data = {
            "documentId": ObjectId(document_id),
            "approverId": approver_id,
            "status": APPROVAL_RECORD_STATUS_APPROVED,
            "comment": comment,
        }
        return await self.create(approval_data)

    async def create_rejected(
        self, document_id: str, approver_id: str, comment: str
    ) -> str:
        """创建已驳回审批记录"""
        if not ObjectId.is_valid(document_id):
            raise ValueError("Invalid document_id")

        approval_data = {
            "documentId": ObjectId(document_id),
            "approverId": approver_id,
            "status": APPROVAL_RECORD_STATUS_REJECTED,
            "comment": comment,
        }
        return await self.create(approval_data)

    async def count_by_document(self, document_id: str) -> int:
        """统计文档的审批记录数量"""
        if not ObjectId.is_valid(document_id):
            return 0
        return await self.collection.count_documents(
            {"documentId": ObjectId(document_id)}
        )
