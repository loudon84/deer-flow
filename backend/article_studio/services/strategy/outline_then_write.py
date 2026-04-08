import json
from .base import GenerationStrategy
from article_studio.integrations import ModelFactoryAdapter


class OutlineThenWriteStrategy(GenerationStrategy):
    """大纲后写作策略"""

    @property
    def name(self) -> str:
        return "outline_then_write"

    async def execute(
        self,
        template: dict,
        template_version: dict,
        params: dict,
        model_adapter: ModelFactoryAdapter,
    ) -> dict:
        """执行大纲后写作"""
        # 获取配置
        model_name = template_version.get("defaultModelName")
        system_prompt = template_version.get("systemPrompt")
        user_prompt_template = template_version.get("userPromptTemplate")

        # 第一步：生成大纲
        outline = await self._generate_outline(
            model_adapter, model_name, system_prompt, user_prompt_template, params
        )

        # 第二步：根据大纲生成内容
        sections = await self._generate_sections(
            model_adapter, model_name, system_prompt, outline, params
        )

        # 第三步：合并内容
        return self._merge_sections(sections, params)

    async def _generate_outline(
        self,
        model_adapter: ModelFactoryAdapter,
        model_name: str,
        system_prompt: str | None,
        user_prompt_template: str,
        params: dict,
    ) -> list[dict]:
        """生成大纲"""
        from jinja2 import Template

        # 渲染提示词
        jinja_template = Template(user_prompt_template)
        user_prompt = jinja_template.render(**params, mode="outline")

        # 添加大纲生成指令
        outline_prompt = f"{user_prompt}\n\n请先为这篇文章生成一个详细的大纲，包含各个章节的标题和简要描述。以 JSON 格式返回，格式如下：\n{{\"sections\": [{{\"title\": \"章节标题\", \"description\": \"章节描述\"}}]}}"

        # 调用模型
        content = await model_adapter.call_model(
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=outline_prompt,
        )

        # 解析大纲
        try:
            result = json.loads(content)
            return result.get("sections", [])
        except json.JSONDecodeError:
            # 如果解析失败，返回默认大纲
            return [
                {"title": "引言", "description": "文章引言部分"},
                {"title": "正文", "description": "文章主要内容"},
                {"title": "总结", "description": "文章总结部分"},
            ]

    async def _generate_sections(
        self,
        model_adapter: ModelFactoryAdapter,
        model_name: str,
        system_prompt: str | None,
        outline: list[dict],
        params: dict,
    ) -> list[dict]:
        """根据大纲生成各章节内容"""
        sections = []

        for section_info in outline:
            section_title = section_info.get("title", "")
            section_description = section_info.get("description", "")

            # 生成章节内容
            section_prompt = f"请为以下章节撰写详细内容：\n\n章节标题：{section_title}\n章节描述：{section_description}\n\n请直接返回章节内容，不要包含标题。"

            content = await model_adapter.call_model(
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=section_prompt,
            )

            sections.append(
                {
                    "title": section_title,
                    "content": content,
                }
            )

        return sections

    def _merge_sections(self, sections: list[dict], params: dict) -> dict:
        """合并章节内容"""
        # 生成完整内容
        content_parts = []
        keywords = []

        for section in sections:
            title = section.get("title", "")
            content = section.get("content", "")
            content_parts.append(f"## {title}\n\n{content}")

        full_content = "\n\n".join(content_parts)

        return {
            "title": params.get("title", "Generated Document"),
            "contentMarkdown": full_content,
            "summary": None,
            "keywords": keywords,
        }
