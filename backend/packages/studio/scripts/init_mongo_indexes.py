import asyncio
from studio.db.indexes import ensure_indexes


async def main():
    """初始化 MongoDB 索引"""
    await ensure_indexes()
    print("Mongo indexes ensured.")


if __name__ == "__main__":
    asyncio.run(main())
