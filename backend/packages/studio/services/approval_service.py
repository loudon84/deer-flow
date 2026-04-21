from studio.repositories import (
    DocumentRepository,
    ApprovalRepository,
    RagflowTaskRepository,
)
from studio.models.persistence import (
    APPROVAL_STATUS_DRAFT,
    APPROVAL_STATUS_PENDING,
    APPROVAL_STATUS_APPROVED,
    APPROVAL_STATUS_REJECTED,
)
from bson import ObjectId


class ApprovalService:
    """审批服务"""

    def __init__(self):
        self.document_repo = DocumentRepository()
        self.approval_repo = ApprovalRepository()
        self.ragflow_task_repo = RagflowTaskRepository()

    async def submit_for_approval(
        self, document_id: str, user_id: str, comment: str | None = None
    ) -> str:
        """提交审批"""
        # 获取文档
        document = await self.document_repo.find_by_id(document_id)
        if not document:
            raise ValueError("Document not found")

        # 检查状态
        if document["approvalStatus"] not in [APPROVAL_STATUS_DRAFT, APPROVAL_STATUS_REJECTED]:
            raise ValueError(
                f"Cannot submit for approval: current status is {document['approvalStatus']}"
            )

        # 更新文档状态
        await self.document_repo.submit_for_approval(document_id)

        # 创建审批记录
        approval_id = await self.approval_repo.create_pending_approval(
            document_id=document_id,
            approver_id=user_id,
            comment=comment,
        )

        return approval_id

    async def approve_document(
        self,
        document_id: str,
        approver_id: str,
        knowledgebase_id: str,
        dataset_id: str | None = None,
        comment: str | None = None,
    ) -> tuple[str, str]:
        """
        审批通过

        Returns:
            (approval_id, ragflow_task_id)
        """
        # 获取文档
        document = await self.document_repo.find_by_id(document_id)
        if not document:
            raise ValueError("Document not found")

        # 检查状态
        if document["approvalStatus"] != APPROVAL_STATUS_PENDING:
            raise ValueError(
                f"Cannot approve: current status is {document['approvalStatus']}"
            )

        # 更新文档状态
        await self.document_repo.approve(document_id)

        # 创建审批记录
        approval_id = await self.approval_repo.create_approved(
            document_id=document_id,
            approver_id=approver_id,
            comment=comment,
        )

        # 创建 RAGFlow 入库任务
        ragflow_task_data = {
            "documentId": ObjectId(document_id),
            "documentVersion": document["version"],
            "knowledgebaseId": knowledgebase_id,
            "datasetId": dataset_id,
        }
        ragflow_task_id = await self.ragflow_task_repo.create(ragflow_task_data)

        # 更新文档的 RAGFlow 状态
        await self.document_repo.set_ragflow_queued(document_id)

        return approval_id, ragflow_task_id

    async def reject_document(
        self, document_id: str, approver_id: str, comment: str
    ) -> str:
        """审批驳回"""
        # 获取文档
        document = await self.document_repo.find_by_id(document_id)
        if not document:
            raise ValueError("Document not found")

        # 检查状态
        if document["approvalStatus"] != APPROVAL_STATUS_PENDING:
            raise ValueError(
                f"Cannot reject: current status is {document['approvalStatus']}"
            )

        # 更新文档状态
        await self.document_repo.reject(document_id)

        # 创建审批记录
        approval_id = await self.approval_repo.create_rejected(
            document_id=document_id,
            approver_id=approver_id,
            comment=comment,
        )

        return approval_id

    async def get_approval_history(
        self, document_id: str, skip: int = 0, limit: int = 20
    ) -> tuple[list[dict], int]:
        """获取审批历史"""
        approvals = await self.approval_repo.find_by_document_id(
            document_id, skip=skip, limit=limit
        )
        total = await self.approval_repo.count_by_document(document_id)
        return approvals, total

    async def get_document(self, document_id: str) -> dict | None:
        """获取文档详情"""
        return await self.document_repo.find_by_id(document_id)

    async def update_document(
        self,
        document_id: str,
        title: str | None,
        content_markdown: str,
        summary: str | None,
        keywords: list[str] | None,
    ) -> bool:
        """更新文档内容"""
        document = await self.document_repo.find_by_id(document_id)
        if not document:
            raise ValueError("Document not found")

        # 只有 draft 或 rejected 状态才能修改
        if document["approvalStatus"] not in [APPROVAL_STATUS_DRAFT, APPROVAL_STATUS_REJECTED]:
            raise ValueError(
                f"Cannot update: current status is {document['approvalStatus']}"
            )

        return await self.document_repo.update_content(
            document_id=document_id,
            title=title,
            content_markdown=content_markdown,
            summary=summary,
            keywords=keywords,
        )

    async def list_documents(
        self,
        template_id: str | None = None,
        approval_status: str | None = None,
        ragflow_status: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[dict], int]:
        """列表查询文档"""
        documents = await self.document_repo.find_list(
            template_id=template_id,
            approval_status=approval_status,
            ragflow_status=ragflow_status,
            skip=skip,
            limit=limit,
        )
        total = await self.document_repo.count(
            template_id=template_id,
            approval_status=approval_status,
            ragflow_status=ragflow_status,
        )
        return documents, total

    async def get_ragflow_status(self, document_id: str) -> dict | None:
        """获取文档的 RAGFlow 状态"""
        # 获取文档
        document = await self.document_repo.find_by_id(document_id)
        if not document:
            raise ValueError("Document not found")

        # 查询最新的 RAGFlow 任务
        tasks = await self.ragflow_task_repo.find_by_document(document_id)
        if not tasks:
            return None

        # 返回最新的任务
        latest_task = tasks[0]
        return latest_task

    async def retry_ragflow_indexing(self, document_id: str) -> str:
        """重试 RAGFlow 索引"""
        # 获取文档
        document = await self.document_repo.find_by_id(document_id)
        if not document:
            raise ValueError("Document not found")

        # 查询最新的失败任务
        tasks = await self.ragflow_task_repo.find_by_document(document_id)
        if not tasks:
            raise ValueError("No RAGFlow task found for this document")

        latest_task = tasks[0]
        if latest_task["status"] != "failed":
            raise ValueError("Only failed tasks can be retried")

        # 创建新的重试任务
        ragflow_task_data = {
            "documentId": ObjectId(document_id),
            "documentVersion": document["version"],
            "knowledgebaseId": latest_task["knowledgebaseId"],
            "datasetId": latest_task.get("datasetId"),
        }
        ragflow_task_id = await self.ragflow_task_repo.create(ragflow_task_data)

        # 更新文档的 RAGFlow 状态
        await self.document_repo.set_ragflow_queued(document_id)

        return ragflow_task_id
