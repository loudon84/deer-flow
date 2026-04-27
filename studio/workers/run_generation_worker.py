import asyncio
import logging
import sys
from studio.workers.generation_worker import GenerationWorker

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


async def main():
    """运行 Generation Worker"""
    worker = GenerationWorker()

    # Windows 不支持 add_signal_handler，使用 try/except 处理
    if sys.platform != "win32":
        import signal

        def signal_handler():
            logger.info("Received shutdown signal")
            worker.stop()

        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, signal_handler)

    # 启动 Worker
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Received KeyboardInterrupt")
        worker.stop()
    except Exception as e:
        logger.error(f"Worker failed: {e}", exc_info=True)
    finally:
        logger.info("Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
