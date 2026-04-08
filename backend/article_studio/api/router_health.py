from fastapi import APIRouter
from datetime import datetime
from article_studio.db import get_mongo_manager

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """健康检查"""
    try:
        # 检查 MongoDB 连接
        mongo_manager = get_mongo_manager()
        await mongo_manager.db.command("ping")
        mongo_status = "healthy"
    except Exception as e:
        mongo_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if mongo_status == "healthy" else "unhealthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "mongodb": mongo_status,
        },
    }
