from .base import GenerationStrategy
from .single_pass import SinglePassStrategy
from .outline_then_write import OutlineThenWriteStrategy


class StrategyRegistry:
    """策略注册表"""

    def __init__(self):
        self._strategies: dict[str, GenerationStrategy] = {}
        self._register_default_strategies()

    def _register_default_strategies(self):
        """注册默认策略"""
        self.register(SinglePassStrategy())
        self.register(OutlineThenWriteStrategy())

    def register(self, strategy: GenerationStrategy):
        """注册策略"""
        self._strategies[strategy.name] = strategy

    def get(self, name: str) -> GenerationStrategy | None:
        """获取策略"""
        return self._strategies.get(name)

    def list_strategies(self) -> list[str]:
        """列出所有策略名称"""
        return list(self._strategies.keys())

    def has_strategy(self, name: str) -> bool:
        """检查策略是否存在"""
        return name in self._strategies


# 全局策略注册表实例
_strategy_registry = None


def get_strategy_registry() -> StrategyRegistry:
    """获取策略注册表单例"""
    global _strategy_registry
    if _strategy_registry is None:
        _strategy_registry = StrategyRegistry()
    return _strategy_registry
