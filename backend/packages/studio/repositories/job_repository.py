from datetime import datetime

from bson import ObjectId

from studio.db.collections import COLLECTION_ARTICLE_JOBS, get_collection
from studio.models.persistence import (
    JOB_STATUS_CANCELLED,
    JOB_STATUS_FAILED,
    JOB_STATUS_QUEUED,
    JOB_STATUS_RUNNING,
    JOB_STATUS_SUCCEEDED,
    JOB_STATUS_WAITING_HUMAN,
)


class JobRepository:
    """任务仓储"""

    def __init__(self):
        self.collection = get_collection(COLLECTION_ARTICLE_JOBS)

    async def create(self, job_data: dict) -> str:
        """创建任务"""
        now = datetime.utcnow()
        job_data["createdAt"] = now
        job_data["updatedAt"] = now
        job_data["status"] = JOB_STATUS_QUEUED

        result = await self.collection.insert_one(job_data)
        return str(result.inserted_id)

    async def find_by_id(self, job_id: str) -> dict | None:
        """根据 ID 查询任务"""
        if not ObjectId.is_valid(job_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(job_id)})

    async def find_list(
        self,
        user_id: str | None = None,
        template_id: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        """列表查询任务"""
        query = {}
        if user_id:
            query["userId"] = user_id
        if template_id and ObjectId.is_valid(template_id):
            query["templateId"] = ObjectId(template_id)
        if status:
            query["status"] = status

        cursor = (
            self.collection.find(query)
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_queued_jobs(self, limit: int = 100) -> list[dict]:
        """查询待处理任务"""
        cursor = (
            self.collection.find({"status": JOB_STATUS_QUEUED})
            .sort("createdAt", 1)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def update_status(
        self, job_id: str, status: str, extra_data: dict | None = None
    ) -> bool:
        """更新任务状态"""
        if not ObjectId.is_valid(job_id):
            return False

        update_data = {"status": status, "updatedAt": datetime.utcnow()}
        if extra_data:
            update_data.update(extra_data)

        result = await self.collection.update_one(
            {"_id": ObjectId(job_id)}, {"$set": update_data}
        )
        return result.modified_count > 0

    async def set_running(self, job_id: str) -> bool:
        """设置任务为运行中"""
        return await self.update_status(job_id, JOB_STATUS_RUNNING)

    async def set_succeeded(self, job_id: str, document_id: str) -> bool:
        """设置任务为成功"""
        if not ObjectId.is_valid(document_id):
            return False
        return await self.update_status(
            job_id, JOB_STATUS_SUCCEEDED, {"documentId": ObjectId(document_id)}
        )

    async def set_failed(self, job_id: str, error: str) -> bool:
        """设置任务为失败"""
        return await self.update_status(
            job_id, JOB_STATUS_FAILED, {"lastError": error}
        )

    async def cancel(self, job_id: str) -> bool:
        """取消任务"""
        # 只能取消 queued 状态的任务
        if not ObjectId.is_valid(job_id):
            return False

        result = await self.collection.update_one(
            {"_id": ObjectId(job_id), "status": JOB_STATUS_QUEUED},
            {"$set": {"status": JOB_STATUS_CANCELLED, "updatedAt": datetime.utcnow()}},
        )
        return result.modified_count > 0

    async def count(
        self,
        user_id: str | None = None,
        template_id: str | None = None,
        status: str | None = None,
    ) -> int:
        """统计任务数量"""
        query = {}
        if user_id:
            query["userId"] = user_id
        if template_id and ObjectId.is_valid(template_id):
            query["templateId"] = ObjectId(template_id)
        if status:
            query["status"] = status
        return await self.collection.count_documents(query)

    async def add_work_log(self, job_id: str, step: str, details: dict) -> bool:
        """添加工作日志

        Args:
            job_id: 任务ID
            step: 步骤名称
            details: 步骤详情

        Returns:
            bool: 是否更新成功
        """
        if not ObjectId.is_valid(job_id):
            return False

        log_entry = {
            "step": step,
            "timestamp": datetime.utcnow(),
            "details": details
        }

        result = await self.collection.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$push": {"workLogs": log_entry},
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    async def patch_runtime_binding(
        self,
        job_id: str,
        *,
        runtime_session_id: str,
        runtime_provider: str,
        runtime_status: str,
    ) -> bool:
        """绑定 DeerFlow runtime session 到任务"""
        if not ObjectId.is_valid(job_id) or not ObjectId.is_valid(runtime_session_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "runtimeProvider": runtime_provider,
                    "runtimeSessionId": ObjectId(runtime_session_id),
                    "runtimeStatus": runtime_status,
                    "updatedAt": datetime.utcnow(),
                }
            },
        )
        return result.modified_count > 0

    async def set_waiting_human(self, job_id: str) -> bool:
        """任务进入等待人工（HITL）"""
        return await self.update_status(job_id, JOB_STATUS_WAITING_HUMAN)

    async def update_tokens_usage(self, job_id: str, tokens_info: dict) -> bool:
        """更新 tokens 使用量

        Args:
            job_id: 任务ID
            tokens_info: tokens 信息,包含 prompt_tokens, completion_tokens, total_tokens

        Returns:
            bool: 是否更新成功
        """
        if not ObjectId.is_valid(job_id):
            return False

        result = await self.collection.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$inc": {
                    "totalPromptTokens": tokens_info.get("prompt_tokens", 0),
                    "totalCompletionTokens": tokens_info.get("completion_tokens", 0),
                    "totalTokens": tokens_info.get("total_tokens", 0)
                },
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        return result.modified_count > 0
