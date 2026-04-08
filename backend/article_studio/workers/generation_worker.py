import asyncio
import logging
from article_studio.repositories import JobRepository
from article_studio.services import ArticleGenerationService
from article_studio.settings import ArticleStudioSettings

logger = logging.getLogger(__name__)


class GenerationWorker:
    """生成 Worker"""

    def __init__(self):
        self.settings = ArticleStudioSettings()
        self.job_repo = JobRepository()
        self.generation_service = ArticleGenerationService()
        self.running = False

    async def start(self):
        """启动 Worker"""
        logger.info("Generation Worker started")
        self.running = True

        while self.running:
            try:
                await self._process_jobs()
            except Exception as e:
                logger.error(f"Error in Generation Worker: {e}", exc_info=True)

            # 等待下一次轮询
            await asyncio.sleep(self.settings.worker_poll_seconds)

    def stop(self):
        """停止 Worker"""
        logger.info("Generation Worker stopping")
        self.running = False

    async def _process_jobs(self):
        """处理待执行的任务"""
        # 获取待处理任务
        jobs = await self.job_repo.find_queued_jobs(limit=10)

        if not jobs:
            return

        logger.info(f"Found {len(jobs)} queued jobs")

        # 并发处理任务
        tasks = [self._process_job(job) for job in jobs]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _process_job(self, job: dict):
        """处理单个任务"""
        job_id = str(job["_id"])
        logger.info(f"Processing job {job_id}")

        try:
            document_id = await self.generation_service.execute_job(job_id)
            logger.info(f"Job {job_id} completed, document_id: {document_id}")
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}", exc_info=True)
