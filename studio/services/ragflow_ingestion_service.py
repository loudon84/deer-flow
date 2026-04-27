from studio.repositories import (
    DocumentRepository,
    RagflowTaskRepository,
)
from studio.integrations import RagflowClient
from studio.models.persistence import (
    RAGFLOW_TASK_STATUS_INDEXED,
    RAGFLOW_TASK_STATUS_FAILED,
)


class RagflowIngestionService:
    """RAGFlow 入库服务"""

    def __init__(self):
        self.document_repo = DocumentRepository()
        self.ragflow_task_repo = RagflowTaskRepository()
        self.ragflow_client = RagflowClient()

    async def execute_ingestion(self, task_id: str) -> bool:
        """执行入库任务（由 Worker 调用）"""
        # 获取任务
        task = await self.ragflow_task_repo.find_by_id(task_id)
        if not task:
            raise ValueError("Task not found")

        # 检查 knowledgebaseId 是否存在
        knowledgebase_id = task.get("knowledgebaseId")
        if not knowledgebase_id:
            raise ValueError(
                f"Task {task_id} missing knowledgebaseId. "
                "Please ensure the document was approved with a valid knowledgebase_id parameter."
            )

        # 获取文档
        document = await self.document_repo.find_by_id(str(task["documentId"]))
        if not document:
            raise ValueError("Document not found")

        # 设置为索引中
        await self.ragflow_task_repo.set_indexing(task_id)
        await self.document_repo.set_ragflow_indexing(str(task["documentId"]))

        try:
            # 调用 RAGFlow API 上传文档
            result = await self.ragflow_client.upload_document(
                knowledgebase_id=knowledgebase_id,
                document_name=document["title"],
                content=document["contentMarkdown"],
                dataset_id=task.get("datasetId"),
            )

            # 检查响应状态
            if result and result.get('code') == 0:
                # RAGFlow v0.24.0 响应格式: {"code": 0, "data": [{"id": "...", ...}]}
                if "data" in result and isinstance(result["data"], list) and len(result["data"]) > 0:
                    ragflow_document_id = result["data"][0].get("id")
                else:
                    raise ValueError(f"无法从响应中获取文档 ID: {result}")
            else:
                raise ValueError(f"RAGFlow 上传失败: {result.get('message', '未知错误')}")

            if not ragflow_document_id:
                raise ValueError(f"无法获取文档 ID: {result}")

            # 更新任务状态
            await self.ragflow_task_repo.set_indexed(task_id, ragflow_document_id)
            await self.document_repo.set_ragflow_indexed(str(task["documentId"]))

            return True

        except Exception as e:
            # 记录错误
            error_msg = str(e)
            await self.ragflow_task_repo.set_failed(task_id, error_msg)
            await self.document_repo.set_ragflow_failed(str(task["documentId"]))
            raise

    async def get_task_status(self, task_id: str) -> dict | None:
        """获取任务状态"""
        return await self.ragflow_task_repo.find_by_id(task_id)

    async def get_document_ingestion_status(self, document_id: str) -> list[dict]:
        """获取文档的入库状态"""
        return await self.ragflow_task_repo.find_by_document(document_id)

    async def check_ragflow_document_status(
        self, knowledgebase_id: str, ragflow_document_id: str
    ) -> dict:
        """检查 RAGFlow 文档状态"""
        return await self.ragflow_client.get_document_status(
            knowledgebase_id=knowledgebase_id,
            document_id=ragflow_document_id,
        )
