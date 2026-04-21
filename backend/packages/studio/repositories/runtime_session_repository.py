from datetime import datetime

from bson import ObjectId

from studio.db.collections import COLLECTION_RUNTIME_SESSIONS, get_collection


class RuntimeSessionRepository:
    """portal_runtime_sessions 仓储"""

    def __init__(self) -> None:
        self.collection = get_collection(COLLECTION_RUNTIME_SESSIONS)

    async def insert_one(self, doc: dict) -> str:
        """插入 session 文档，返回 _id 字符串"""
        now = datetime.utcnow()
        if "createdAt" not in doc:
            doc["createdAt"] = now
        doc["updatedAt"] = now
        result = await self.collection.insert_one(doc)
        return str(result.inserted_id)

    async def find_by_id(self, session_id: str) -> dict | None:
        if not ObjectId.is_valid(session_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(session_id)})

    async def find_latest_by_owner(self, owner_type: str, owner_id: str) -> dict | None:
        cursor = (
            self.collection.find({"ownerType": owner_type, "ownerId": owner_id})
            .sort("createdAt", -1)
            .limit(1)
        )
        rows = await cursor.to_list(length=1)
        return rows[0] if rows else None

    async def update_status(
        self,
        session_id: str,
        status: str,
        *,
        current_interrupt: dict | None = None,
        extra: dict | None = None,
    ) -> bool:
        if not ObjectId.is_valid(session_id):
            return False
        update: dict = {"status": status, "updatedAt": datetime.utcnow()}
        if current_interrupt is not None:
            update["currentInterrupt"] = current_interrupt
        if extra:
            update.update(extra)
        result = await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update},
        )
        return result.modified_count > 0

    async def update_summary(self, session_id: str, summary: dict) -> bool:
        if not ObjectId.is_valid(session_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"summary": summary, "updatedAt": datetime.utcnow()}},
        )
        return result.modified_count > 0

    async def patch_summary_fields(self, session_id: str, fields: dict) -> bool:
        """合并更新 summary 子字段（点号路径）"""
        if not ObjectId.is_valid(session_id):
            return False
        set_doc = {f"summary.{k}": v for k, v in fields.items()}
        set_doc["updatedAt"] = datetime.utcnow()
        result = await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": set_doc},
        )
        return result.modified_count > 0

    async def set_latest_run_id(self, session_id: str, run_id: str | None) -> bool:
        if not ObjectId.is_valid(session_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"latestRunId": run_id, "updatedAt": datetime.utcnow()}},
        )
        return result.modified_count > 0

    async def set_materialized_result(self, session_id: str, payload: dict) -> bool:
        """保存物化结果摘要（供 GET /results/latest）"""
        if not ObjectId.is_valid(session_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"materializedResult": payload, "updatedAt": datetime.utcnow()}},
        )
        return result.modified_count > 0

    async def atomic_inc_last_event_seq(self, session_id: str, inc: int = 1) -> int | None:
        """原子递增 summary.lastEventSeq 并返回递增后的值。用于事件写入时获取唯一 seq。"""
        if not ObjectId.is_valid(session_id):
            return None
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(session_id)},
            {
                "$inc": {"summary.lastEventSeq": inc},
                "$set": {"updatedAt": datetime.utcnow()},
            },
            projection={"summary.lastEventSeq": 1},
        )
        if not result:
            return None
        return int((result.get("summary") or {}).get("lastEventSeq", 0))
