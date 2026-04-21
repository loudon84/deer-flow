from datetime import datetime

from bson import ObjectId

from studio.db.collections import COLLECTION_HITL_ACTIONS, get_collection


class RuntimeHitlRepository:
    """portal_hitl_actions 仓储"""

    def __init__(self) -> None:
        self.collection = get_collection(COLLECTION_HITL_ACTIONS)

    async def insert_one(self, doc: dict) -> str:
        now = datetime.utcnow()
        if "createdAt" not in doc:
            doc["createdAt"] = now
        result = await self.collection.insert_one(doc)
        return str(result.inserted_id)

    async def find_by_session(self, session_id: str, limit: int = 100) -> list[dict]:
        if not ObjectId.is_valid(session_id):
            return []
        sid = ObjectId(session_id)
        cur = (
            self.collection.find({"sessionId": sid})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return await cur.to_list(length=limit)
