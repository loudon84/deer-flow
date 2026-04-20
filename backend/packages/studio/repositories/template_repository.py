from datetime import datetime
from bson import ObjectId
from studio.db.collections import get_collection, COLLECTION_ARTICLE_TEMPLATES
from studio.models.persistence import (
    TEMPLATE_STATUS_ACTIVE,
    TEMPLATE_STATUS_INACTIVE,
    TEMPLATE_STATUS_ARCHIVED,
)


class TemplateRepository:
    """模板仓储"""

    def __init__(self):
        self.collection = get_collection(COLLECTION_ARTICLE_TEMPLATES)

    async def create(self, template_data: dict) -> str:
        """创建模板"""
        now = datetime.utcnow()
        template_data["createdAt"] = now
        template_data["updatedAt"] = now
        template_data["currentVersion"] = 1
        # Use provided status or default to active
        if "status" not in template_data:
            template_data["status"] = TEMPLATE_STATUS_ACTIVE

        result = await self.collection.insert_one(template_data)
        return str(result.inserted_id)

    async def find_by_id(self, template_id: str) -> dict | None:
        """根据 ID 查询模板"""
        if not ObjectId.is_valid(template_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(template_id)})

    async def find_by_code(self, code: str) -> dict | None:
        """根据 code 查询模板"""
        return await self.collection.find_one({"code": code})

    async def find_list(
        self,
        status: str | None = None,
        category: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict]:
        """列表查询模板"""
        query = {}
        if status:
            query["status"] = status
        if category:
            query["category"] = category

        cursor = (
            self.collection.find(query)
            .sort("updatedAt", -1)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def update(self, template_id: str, update_data: dict) -> bool:
        """更新模板"""
        if not ObjectId.is_valid(template_id):
            return False

        update_data["updatedAt"] = datetime.utcnow()
        result = await self.collection.update_one(
            {"_id": ObjectId(template_id)}, {"$set": update_data}
        )
        return result.modified_count > 0

    async def increment_version(self, template_id: str) -> bool:
        """递增版本号"""
        if not ObjectId.is_valid(template_id):
            return False

        result = await self.collection.update_one(
            {"_id": ObjectId(template_id)},
            {
                "$inc": {"currentVersion": 1},
                "$set": {"updatedAt": datetime.utcnow()},
            },
        )
        return result.modified_count > 0

    async def delete(self, template_id: str) -> bool:
        """删除模板"""
        if not ObjectId.is_valid(template_id):
            return False

        result = await self.collection.delete_one({"_id": ObjectId(template_id)})
        return result.deleted_count > 0

    async def count(self, status: str | None = None, category: str | None = None) -> int:
        """统计模板数量"""
        query = {}
        if status:
            query["status"] = status
        if category:
            query["category"] = category
        return await self.collection.count_documents(query)
