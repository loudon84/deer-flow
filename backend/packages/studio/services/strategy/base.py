from abc import ABC, abstractmethod
from typing import Any, Callable


class GenerationStrategy(ABC):
    """生成策略基类"""

    @abstractmethod
    async def execute(
        self,
        template: dict,
        template_version: dict,
        params: dict[str, Any],
        model_adapter: Any,
        log_callback: Callable[[str, dict], None] | None = None,
    ) -> dict:
        """
        执行生成

        Args:
            template: 模板信息
            template_version: 模板版本信息
            params: 输入参数
            model_adapter: 模型适配器
            log_callback: 日志回调函数,用于记录工作步骤

        Returns:
            生成的文档数据，包含 title, contentMarkdown, summary, keywords 等字段
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """策略名称"""
        pass
