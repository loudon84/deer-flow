#!/usr/bin/env python3
"""
Run Generation Worker with correct Python path
"""

import sys
import os

# Add packages directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
packages_dir = os.path.join(backend_dir, "packages")
sys.path.insert(0, packages_dir)

# Now import and run the worker
import asyncio
import signal
import logging
from studio.workers.generation_worker import GenerationWorker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


async def main():
    """Run Generation Worker"""
    logger.info("Starting Generation Worker...")
    logger.info(f"Python path: {sys.path[:3]}")
    
    worker = GenerationWorker()

    # Setup signal handlers (only on Unix-like systems)
    if sys.platform != 'win32':
        def signal_handler():
            logger.info("Received shutdown signal")
            worker.stop()

        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, signal_handler)
    else:
        # On Windows, use try/except to handle Ctrl+C
        logger.info("Running on Windows - Ctrl+C to stop")

    # Start Worker
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
