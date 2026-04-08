import asyncio
import logging
from article_studio.repositories import RagflowTaskRepository
from article_studio.services import RagflowIngestionService
from article_studio.settings import ArticleStudioSettings

logger = logging.getLogger(__name__)


class RagflowIngestionWorker:
    """RAGFlow 入库 Worker"""

    def __init__(self):
        self.settings = ArticleStudioSettings()
        self.ragflow_task_repo = RagflowTaskRepository()
        self.ragflow_service = RagflowIngestionService()
        self.running = False

    async def start(self):
        """启动 Worker"""
        logger.info("RAGFlow Ingestion Worker started")
        self.running = True

        while self.running:
            try:
                await self._process_tasks()
            except Exception as e:
                logger.error(f"Error in RAGFlow Ingestion Worker: {e}", exc_info=True)

            # 等待下一次轮询
            await asyncio.sleep(self.settings.ragflow_worker_poll_seconds)

    def stop(self):
        """停止 Worker"""
        logger.info("RAGFlow Ingestion Worker stopping")
        self.running = False

    async def _process_tasks(self):
        """处理待入库的任务"""
        # 获取待处理任务
        tasks = await self.ragflow_task_repo.find_queued_tasks(limit=10)

        if not tasks:
            return

        logger.info(f"Found {len(tasks)} queued RAGFlow tasks")

        # 并发处理任务
        process_tasks = [self._process_task(task) for task in tasks]
        await asyncio.gather(*process_tasks, return_exceptions=True)

    async def _process_task(self, task: dict):
        """处理单个任务"""
        task_id = str(task["_id"])
        logger.info(f"Processing RAGFlow task {task_id}")

        try:
            success = await self.ragflow_service.execute_ingestion(task_id)
            if success:
                logger.info(f"RAGFlow task {task_id} completed")
        except Exception as e:
            logger.error(f"RAGFlow task {task_id} failed: {e}", exc_info=True)
