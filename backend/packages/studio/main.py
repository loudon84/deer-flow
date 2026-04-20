import os
from pathlib import Path
import uvicorn
from studio.api import app
from studio.settings import StudioSettings


def load_env_file(env_path: Path) -> None:
    """手动加载 .env 文件"""
    if not env_path.exists():
        print(f"Warning: .env file not found at {env_path}")
        return

    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue
            # 解析 KEY=VALUE
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                # 设置环境变量
                os.environ[key] = value
                print(f"Loaded env: {key}={value}")


def main():
    """启动 Article Studio API 服务"""
    # 加载 .env 文件
    env_path = Path(__file__).parent.parent.parent / ".env"
    print(f"Loading .env from: {env_path}")
    print(f".env file exists: {env_path.exists()}")
    load_env_file(env_path)

    # 打印环境变量验证
    print(f"STUDIO_MONGODB_URI from env: {os.getenv('STUDIO_MONGODB_URI')}")

    settings = StudioSettings()
    print(f"Settings mongodb_uri: {settings.mongodb_uri}")

    uvicorn.run(
        "studio.api.app:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
