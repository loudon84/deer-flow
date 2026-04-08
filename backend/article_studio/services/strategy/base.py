from abc import ABC, abstractmethod
from typing import Any


class GenerationStrategy(ABC):
    """生成策略基类"""

    @abstractmethod
    async def execute(
        self,
        template: dict,
        template_version: dict,
        params: dict[str, Any],
        model_adapter: Any,
    ) -> dict:
        """
        执行生成

        Args:
            template: 模板信息
            template_version: 模板版本信息
            params: 输入参数
            model_adapter: 模型适配器

        Returns:
            生成的文档数据，包含 title, contentMarkdown, summary, keywords 等字段
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """策略名称"""
        pass
