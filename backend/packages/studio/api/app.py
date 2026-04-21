import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from studio.api.router_documents import router as documents_router
from studio.api.router_health import router as health_router
from studio.api.router_jobs import router as jobs_router
from studio.api.router_runtime_events import router as runtime_events_router
from studio.api.router_runtime_hitl import router as runtime_hitl_router
from studio.api.router_runtime_results import router as runtime_results_router
from studio.api.router_runtime_sessions import router as runtime_sessions_router
from studio.api.router_templates import router as templates_router
from studio.settings import StudioSettings
from studio.workers.generation_worker import GenerationWorker

logger = logging.getLogger(__name__)

# 全局引用，供 lifespan 管理
_worker: GenerationWorker | None = None
_worker_task: "asyncio.Task | None" = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时拉起 Worker 协程，关闭时优雅停止。"""
    import asyncio

    global _worker, _worker_task

    settings = StudioSettings()
    if settings.worker_poll_seconds > 0:
        _worker = GenerationWorker()
        _worker_task = asyncio.create_task(_worker.start())
        logger.info("GenerationWorker started (in-process)")
    else:
        logger.info("GenerationWorker disabled (worker_poll_seconds=0)")

    yield  # app 运行中

    # 关闭：优雅停止 Worker
    if _worker is not None:
        _worker.stop()
    if _worker_task is not None:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
    logger.info("GenerationWorker stopped")


def create_app() -> FastAPI:
    """创建 FastAPI 应用"""
    app = FastAPI(
        title="Article Studio",
        description="文章生成与管理系统",
        version="0.1.0",
        lifespan=lifespan,
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
    app.include_router(runtime_sessions_router)
    app.include_router(runtime_events_router)
    app.include_router(runtime_hitl_router)
    app.include_router(runtime_results_router)

    return app


# 创建应用实例
app = create_app()
