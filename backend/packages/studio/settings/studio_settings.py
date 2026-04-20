from pydantic import BaseModel
import os


class StudioSettings(BaseModel):
    """Studio 配置类"""

    host: str = os.getenv("STUDIO_HOST", "0.0.0.0")
    port: int = int(os.getenv("STUDIO_PORT", "8320"))
    mongodb_uri: str = os.getenv(
        "STUDIO_MONGODB_URI", "mongodb://192.168.102.247:27017"
    )
    mongodb_db: str = os.getenv("STUDIO_MONGODB_DB", "studio")
    worker_poll_seconds: int = int(os.getenv("STUDIO_WORKER_POLL_SECONDS", "3"))
    ragflow_worker_poll_seconds: int = int(
        os.getenv("STUDIO_RAGFLOW_WORKER_POLL_SECONDS", "5")
    )
    model_config_path: str = os.getenv(
        "STUDIO_MODEL_CONFIG_PATH", "./config.yaml"
    )
