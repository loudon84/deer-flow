import yaml
import httpx
from pathlib import Path
from typing import Any
from studio.settings import StudioSettings


class ModelFactoryAdapter:
    """Model Factory 适配器"""

    def __init__(self):
        self.settings = StudioSettings()
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
        models = self.model_config.get("models", [])
        
        # models is a list, find by name
        if isinstance(models, list):
            for model in models:
                if model.get("name") == model_name:
                    return model
            return None
        
        # fallback: if models is a dict (old format)
        return models.get(model_name)

    async def call_model(
        self,
        model_name: str,
        system_prompt: str | None,
        user_prompt: str,
        **kwargs,
    ) -> dict:
        """调用模型生成

        Returns:
            dict: 包含 content, usage, model 等信息的字典
        """
        model_config = self.get_model_config(model_name)
        if not model_config:
            raise ValueError(f"Model {model_name} not found in config")

        # Get API URL and key from config
        # Support multiple config formats:
        # - openai_api_base (config.yaml format)
        # - api_url (old format)
        # - base_url (alternative format)
        api_url = (
            model_config.get("openai_api_base") or
            model_config.get("api_url") or
            model_config.get("base_url")
        )

        # For OpenAI-compatible APIs, append /chat/completions if not present
        if api_url and not api_url.endswith("/chat/completions"):
            if not api_url.endswith("/"):
                api_url += "/"
            api_url += "chat/completions"

        # Get API key
        api_key = (
            model_config.get("openai_api_key") or
            model_config.get("api_key")
        )

        if not api_url:
            raise ValueError(f"API URL not configured for model {model_name}")

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        # Get model ID
        model_id = model_config.get("model", model_name)

        payload = {
            "model": model_id,
            "messages": [],
            **kwargs,
        }

        if system_prompt:
            payload["messages"].append({"role": "system", "content": system_prompt})

        payload["messages"].append({"role": "user", "content": user_prompt})

        # Get timeout from config
        timeout = model_config.get("timeout", 120.0)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                api_url,
                json=payload,
                headers=headers,
                timeout=timeout,
            )
            response.raise_for_status()
            result = response.json()

            # Parse OpenAI format response and return complete info
            return {
                "content": result["choices"][0]["message"]["content"],
                "usage": result.get("usage", {}),
                "model": result.get("model", model_id),
            }

    async def call_model_with_params(
        self,
        model_name: str,
        system_prompt: str | None,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> dict:
        """调用模型生成（带参数）

        Returns:
            dict: 包含 content, usage, model 等信息的字典
        """
        return await self.call_model(
            model_name,
            system_prompt,
            user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
