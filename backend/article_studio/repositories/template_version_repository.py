from datetime import datetime
from bson import ObjectId
from article_studio.db.collections import (
    get_collection,
    COLLECTION_ARTICLE_TEMPLATE_VERSIONS,
)


class TemplateVersionRepository:
    """模板版本仓储"""

    def __init__(self):
        self.collection = get_collection(COLLECTION_ARTICLE_TEMPLATE_VERSIONS)

    async def create(self, version_data: dict) -> str:
        """创建模板版本"""
        version_data["createdAt"] = datetime.utcnow()

        result = await self.collection.insert_one(version_data)
        return str(result.inserted_id)

    async def find_by_template_and_version(
        self, template_id: str, version: int
    ) -> dict | None:
        """根据模板 ID 和版本号查询"""
        if not ObjectId.is_valid(template_id):
            return None
        return await self.collection.find_one(
            {"templateId": ObjectId(template_id), "version": version}
        )

    async def find_by_id(self, version_id: str) -> dict | None:
        """根据 ID 查询版本"""
        if not ObjectId.is_valid(version_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(version_id)})

    async def find_list_by_template(
        self, template_id: str, skip: int = 0, limit: int = 20
    ) -> list[dict]:
        """查询模板的所有版本"""
        if not ObjectId.is_valid(template_id):
            return []

        cursor = (
            self.collection.find({"templateId": ObjectId(template_id)})
            .sort("version", -1)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_latest_version(self, template_id: str) -> dict | None:
        """查询模板的最新版本"""
        if not ObjectId.is_valid(template_id):
            return None

        return await self.collection.find_one(
            {"templateId": ObjectId(template_id)}, sort=[("version", -1)]
        )

    async def count_by_template(self, template_id: str) -> int:
        """统计模板的版本数量"""
        if not ObjectId.is_valid(template_id):
            return 0
        return await self.collection.count_documents(
            {"templateId": ObjectId(template_id)}
        )
