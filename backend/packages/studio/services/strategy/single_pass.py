import json
from typing import Callable
from .base import GenerationStrategy
from studio.integrations import ModelFactoryAdapter


class SinglePassStrategy(GenerationStrategy):
    """单次生成策略"""

    @property
    def name(self) -> str:
        return "single_pass"

    async def execute(
        self,
        template: dict,
        template_version: dict,
        params: dict,
        model_adapter: ModelFactoryAdapter,
        log_callback: Callable[[str, dict], None] | None = None,
    ) -> dict:
        """执行单次生成"""
        # 获取配置
        model_name = template_version.get("defaultModelName")
        system_prompt = template_version.get("systemPrompt")
        user_prompt_template = template_version.get("userPromptTemplate")

        # 记录步骤: 开始渲染提示词
        if log_callback:
            log_callback("prompt_render_started", {
                "model_name": model_name,
                "template_type": "single_pass"
            })

        # 渲染用户提示词
        user_prompt = self._render_prompt(user_prompt_template, params)

        # 记录步骤: 提示词渲染完成
        if log_callback:
            log_callback("prompt_render_completed", {
                "user_prompt_length": len(user_prompt),
                "system_prompt_length": len(system_prompt) if system_prompt else 0
            })

        # 记录步骤: 开始调用模型
        if log_callback:
            log_callback("model_call_started", {
                "model_name": model_name
            })

        # 调用模型生成
        model_result = await model_adapter.call_model(
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        # 记录步骤: 模型调用完成
        if log_callback:
            log_callback("model_call_completed", {
                "model": model_result.get("model"),
                "usage": model_result.get("usage", {}),
                "content_length": len(model_result.get("content", ""))
            })

        # 解析生成结果
        result = self._parse_result(model_result["content"], params)

        # 记录步骤: 结果解析完成
        if log_callback:
            log_callback("result_parse_completed", {
                "title": result.get("title"),
                "content_length": len(result.get("contentMarkdown", "")),
                "has_summary": result.get("summary") is not None,
                "keywords_count": len(result.get("keywords", []))
            })

        # 返回结果时包含 usage 信息
        result["usage"] = model_result.get("usage", {})
        return result

    def _render_prompt(self, template: str, params: dict) -> str:
        """渲染提示词模板"""
        from jinja2 import Template

        jinja_template = Template(template)
        return jinja_template.render(**params)

    def _parse_result(self, content: str, params: dict) -> dict:
        """解析生成结果"""
        # 尝试解析 JSON 格式的结果
        try:
            result = json.loads(content)
            return {
                "title": result.get("title", "Untitled"),
                "contentMarkdown": result.get("content", content),
                "summary": result.get("summary"),
                "keywords": result.get("keywords", []),
            }
        except json.JSONDecodeError:
            # 如果不是 JSON，直接作为内容
            return {
                "title": params.get("title", "Generated Document"),
                "contentMarkdown": content,
                "summary": None,
                "keywords": [],
            }
