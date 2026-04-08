from pydantic import BaseModel
import os


class ArticleStudioSettings(BaseModel):
    """Article Studio 配置类"""

    host: str = os.getenv("ARTICLE_STUDIO_HOST", "0.0.0.0")
    port: int = int(os.getenv("ARTICLE_STUDIO_PORT", "8320"))
    mongodb_uri: str = os.getenv(
        "ARTICLE_STUDIO_MONGODB_URI", "mongodb://localhost:27017"
    )
    mongodb_db: str = os.getenv("ARTICLE_STUDIO_MONGODB_DB", "article_studio")
    worker_poll_seconds: int = int(os.getenv("ARTICLE_WORKER_POLL_SECONDS", "3"))
    ragflow_worker_poll_seconds: int = int(
        os.getenv("ARTICLE_RAGFLOW_WORKER_POLL_SECONDS", "5")
    )
    model_config_path: str = os.getenv(
        "ARTICLE_STUDIO_MODEL_CONFIG_PATH", "./article-models.yaml"
    )
