from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from studio.api.router_health import router as health_router
from studio.api.router_templates import router as templates_router
from studio.api.router_jobs import router as jobs_router
from studio.api.router_documents import router as documents_router


def create_app() -> FastAPI:
    """创建 FastAPI 应用"""
    app = FastAPI(
        title="Article Studio",
        description="文章生成与管理系统",
        version="0.1.0",
    )

    # CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    app.include_router(health_router)
    app.include_router(templates_router)
    app.include_router(jobs_router)
    app.include_router(documents_router)

    return app


# 创建应用实例
app = create_app()
