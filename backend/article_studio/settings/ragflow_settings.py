from pydantic import BaseModel
import os


class RagflowSettings(BaseModel):
    """RAGFlow 配置类"""

    base_url: str = os.getenv(
        "ARTICLE_STUDIO_RAGFLOW_BASE_URL", "http://127.0.0.1:9380"
    )
    api_key: str = os.getenv("ARTICLE_STUDIO_RAGFLOW_API_KEY", "")
    timeout_seconds: int = int(os.getenv("ARTICLE_STUDIO_RAGFLOW_TIMEOUT_SECONDS", "60"))
