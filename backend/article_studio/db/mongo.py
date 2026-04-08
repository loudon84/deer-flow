from functools import lru_cache
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from article_studio.settings.article_studio_settings import ArticleStudioSettings


class MongoManager:
    """MongoDB 连接管理器"""

    def __init__(self, uri: str, db_name: str) -> None:
        self.client: AsyncIOMotorClient = AsyncIOMotorClient(uri)
        self.db: AsyncIOMotorDatabase = self.client[db_name]

    async def close(self) -> None:
        """关闭连接"""
        self.client.close()


@lru_cache(maxsize=1)
def get_mongo_manager() -> MongoManager:
    """获取 MongoDB 管理器单例"""
    settings = ArticleStudioSettings()
    return MongoManager(settings.mongodb_uri, settings.mongodb_db)
