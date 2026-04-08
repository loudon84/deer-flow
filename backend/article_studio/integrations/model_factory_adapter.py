import yaml
import httpx
from pathlib import Path
from typing import Any
from article_studio.settings import ArticleStudioSettings


class ModelFactoryAdapter:
    """Model Factory 适配器"""

    def __init__(self):
        self.settings = ArticleStudioSettings()
        self.model_config = self._load_model_config()

    def _load_model_config(self) -> dict:
        """加载模型配置"""
        config_path = Path(self.settings.model_config_path)
        if not config_path.exists():
            return {}

        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def get_model_config(self, model_name: str) -> dict | None:
        """获取模型配置"""
        models = self.model_config.get("models", {})
        return models.get(model_name)

    async def call_model(
        self,
        model_name: str,
        system_prompt: str | None,
        user_prompt: str,
        **kwargs,
    ) -> str:
        """调用模型生成"""
        model_config = self.get_model_config(model_name)
        if not model_config:
            raise ValueError(f"Model {model_name} not found in config")

        # 这里需要根据实际的 Model Factory API 进行实现
        # 目前提供一个示例实现
        api_url = model_config.get("api_url")
        api_key = model_config.get("api_key")

        if not api_url:
            raise ValueError(f"API URL not configured for model {model_name}")

        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model_config.get("model_id", model_name),
            "messages": [],
            **kwargs,
        }

        if system_prompt:
            payload["messages"].append({"role": "system", "content": system_prompt})

        payload["messages"].append({"role": "user", "content": user_prompt})

        async with httpx.AsyncClient() as client:
            response = await client.post(
                api_url,
                json=payload,
                headers=headers,
                timeout=120.0,
            )
            response.raise_for_status()
            result = response.json()

            # 根据实际 API 响应格式解析结果
            # 这里假设是 OpenAI 格式
            return result["choices"][0]["message"]["content"]

    async def call_model_with_params(
        self,
        model_name: str,
        system_prompt: str | None,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """调用模型生成（带参数）"""
        return await self.call_model(
            model_name,
            system_prompt,
            user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
