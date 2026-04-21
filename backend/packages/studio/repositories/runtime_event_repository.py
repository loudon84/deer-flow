from datetime import datetime

from bson import ObjectId

from studio.db.collections import COLLECTION_RUNTIME_EVENTS, get_collection


class RuntimeEventRepository:
    """portal_runtime_events 仓储"""

    def __init__(self) -> None:
        self.collection = get_collection(COLLECTION_RUNTIME_EVENTS)

    async def insert_one(self, doc: dict) -> str:
        now = datetime.utcnow()
        if "createdAt" not in doc:
            doc["createdAt"] = now
        result = await self.collection.insert_one(doc)
        return str(result.inserted_id)

    async def find_by_id(self, event_id: str) -> dict | None:
        if not ObjectId.is_valid(event_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(event_id)})

    async def get_max_seq(self, session_id: str) -> int:
        if not ObjectId.is_valid(session_id):
            return 0
        sid = ObjectId(session_id)
        doc = await self.collection.find_one({"sessionId": sid}, sort=[("seq", -1)])
        return int(doc["seq"]) if doc and "seq" in doc else 0

    async def list_after_seq(
        self,
        session_id: str,
        *,
        after_seq: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int | None]:
        """seq 大于 after_seq 的事件，升序，最多 limit 条。next_cursor 为最后一条 seq（便于客户端续拉）。"""
        if not ObjectId.is_valid(session_id):
            return [], None
        sid = ObjectId(session_id)
        q: dict = {"sessionId": sid}
        if after_seq >= 0:
            q["seq"] = {"$gt": after_seq}
        cur = self.collection.find(q).sort("seq", 1).limit(limit)
        items = await cur.to_list(length=limit)
        if not items:
            return [], None
        next_cursor = items[-1]["seq"]
        return items, next_cursor
