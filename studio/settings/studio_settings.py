import os

from pydantic import BaseModel


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
    # 必须为 DeerFlow **Gateway** 根地址（提供 POST /api/threads、GET /health 含 service=deer-flow-gateway）。
    # 不要填 LangGraph Server（常见 2024）或其它无 threads 路由的服务，否则会 404。
    # 经 Nginx 统一入口时可填 http://host:2026（与前端同源反代）。
    deerflow_base_url: str = os.getenv(
        "STUDIO_DEERFLOW_BASE_URL", "http://192.168.70.166:2026"
    )
    # DeerFlow 智能体名称（用于 /runs/stream payload 的 context.agent_name）
    # 由运维统一配置，避免让用户在模板里选择。
    deerflow_agent_name: str = os.getenv("STUDIO_DEERFLOW_AGENT_NAME", "opus-reviewer")
    # DeerFlow 运行模式（对应 DeerFlow / LangGraph payload 的 context.mode，例如 "pro"）
    # 注意：Studio 模板中的 default_generation_mode 是 Studio 本地生成策略（single_pass 等），不要混用。
    deerflow_mode: str = os.getenv("STUDIO_DEERFLOW_MODE", "pro")
    # DeerFlow 推理强度默认值（可被模板版本 reasoningEffort 覆盖）
    deerflow_reasoning_effort: str = os.getenv("STUDIO_DEERFLOW_REASONING_EFFORT", "high")
    use_runtime_facade: bool = os.getenv(
        "STUDIO_USE_RUNTIME_FACADE", "1"
    ).lower() in ("1", "true", "yes")
