import json
from .base import GenerationStrategy
from article_studio.integrations import ModelFactoryAdapter


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
    ) -> dict:
        """执行单次生成"""
        # 获取配置
        model_name = template_version.get("defaultModelName")
        system_prompt = template_version.get("systemPrompt")
        user_prompt_template = template_version.get("userPromptTemplate")

        # 渲染用户提示词
        user_prompt = self._render_prompt(user_prompt_template, params)

        # 调用模型生成
        content = await model_adapter.call_model(
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        # 解析生成结果
        return self._parse_result(content, params)

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
