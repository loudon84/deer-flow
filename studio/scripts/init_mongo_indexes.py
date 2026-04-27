"""建索引脚本：可从 backend 目录直接运行 `python packages/studio/scripts/init_mongo_indexes.py`。"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# packages/studio/scripts/ -> parents: studio, packages —— 将 packages 加入 path 以便 import studio
_packages_dir = Path(__file__).resolve().parent.parent.parent
if str(_packages_dir) not in sys.path:
    sys.path.insert(0, str(_packages_dir))

from studio.db.indexes import ensure_indexes


async def main():
    """初始化 MongoDB 索引"""
    await ensure_indexes()
    print("Mongo indexes ensured.")


if __name__ == "__main__":
    asyncio.run(main())
