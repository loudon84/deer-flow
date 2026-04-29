from pydantic import BaseModel
import os


RAGFLOW_DATASETS: list[dict[str, str]] = [
    {"id": "68b2566a333011f1949e15c1295af575", "name": "推广技术文章"},
    {"id": "21ef7002386a11f1b482d32f0d29bd8d", "name": "财务政策"},
]


class RagflowSettings(BaseModel):
    """RAGFlow 配置类"""

    base_url: str = os.getenv(
        "ARTICLE_STUDIO_RAGFLOW_BASE_URL", "http://192.168.102.247:9222"
    )
    api_key: str = os.getenv("ARTICLE_STUDIO_RAGFLOW_API_KEY", "ragflow-GC48uXGSDLkEO_ENhtxtWUqZ5zKcLlbm_6XghbZCGCo")
    knowledgebase_id: str = os.getenv(
        "ARTICLE_STUDIO_RAGFLOW_KNOWLEDGEBASE_ID", RAGFLOW_DATASETS[0]["id"]
    )
    '''
    注意：RAGFlow 使用 dataset 概念而不是 knowledgebase
    可用的 datasets IDs（从 /api/v1/datasets 获取）:
    - ae18bc7037b411f1a297470845c25d8d (推广技术文章相关)
    - 21ef7002386a11f1b482d32f0d29bd8d (财务政策)
    '''

    timeout_seconds: int = int(os.getenv("ARTICLE_STUDIO_RAGFLOW_TIMEOUT_SECONDS", "60"))
