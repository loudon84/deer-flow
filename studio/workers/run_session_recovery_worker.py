#!/usr/bin/env python3
"""
启动 Session Recovery Worker

用法:
    python -m studio.workers.run_session_recovery_worker
    或
    python run_session_recovery_worker.py
"""

import asyncio
import logging
import sys

from studio.workers.session_recovery_worker import SessionRecoveryWorker

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


async def main():
    """运行 Session Recovery Worker"""
    worker = SessionRecoveryWorker()

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
        logger.error("Worker failed: %s", e, exc_info=True)
    finally:
        logger.info("Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
