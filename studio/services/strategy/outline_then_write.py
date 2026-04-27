import json
from typing import Callable
from .base import GenerationStrategy
from studio.integrations import ModelFactoryAdapter


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
        log_callback: Callable[[str, dict], None] | None = None,
    ) -> dict:
        """执行大纲后写作"""
        # 获取配置
        model_name = template_version.get("defaultModelName")
        system_prompt = template_version.get("systemPrompt")
        user_prompt_template = template_version.get("userPromptTemplate")

        # 记录步骤: 开始执行
        if log_callback:
            log_callback("outline_strategy_started", {
                "model_name": model_name
            })

        # 第一步：生成大纲
        outline, outline_usage = await self._generate_outline(
            model_adapter, model_name, system_prompt, user_prompt_template, params, log_callback
        )

        # 第二步：根据大纲生成内容
        sections, sections_usage = await self._generate_sections(
            model_adapter, model_name, system_prompt, outline, params, log_callback
        )

        # 第三步：合并内容
        result = self._merge_sections(sections, params)

        # 记录步骤: 完成
        if log_callback:
            log_callback("outline_strategy_completed", {
                "sections_count": len(sections),
                "total_content_length": len(result.get("contentMarkdown", ""))
            })

        # 合并所有 usage
        total_usage = {
            "prompt_tokens": outline_usage.get("prompt_tokens", 0) + sections_usage.get("prompt_tokens", 0),
            "completion_tokens": outline_usage.get("completion_tokens", 0) + sections_usage.get("completion_tokens", 0),
            "total_tokens": outline_usage.get("total_tokens", 0) + sections_usage.get("total_tokens", 0),
        }
        result["usage"] = total_usage
        return result

    async def _generate_outline(
        self,
        model_adapter: ModelFactoryAdapter,
        model_name: str,
        system_prompt: str | None,
        user_prompt_template: str,
        params: dict,
        log_callback: Callable[[str, dict], None] | None = None,
    ) -> tuple[list[dict], dict]:
        """生成大纲"""
        from jinja2 import Template

        # 记录步骤: 开始生成大纲
        if log_callback:
            log_callback("outline_generation_started", {})

        # 渲染提示词
        jinja_template = Template(user_prompt_template)
        user_prompt = jinja_template.render(**params, mode="outline")

        # 添加大纲生成指令
        outline_prompt = f"{user_prompt}\n\n请先为这篇文章生成一个详细的大纲，包含各个章节的标题和简要描述。以 JSON 格式返回，格式如下：\n{{\"sections\": [{{\"title\": \"章节标题\", \"description\": \"章节描述\"}}]}}"

        # 调用模型
        model_result = await model_adapter.call_model(
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=outline_prompt,
        )

        # 解析大纲
        try:
            result = json.loads(model_result["content"])
            outline = result.get("sections", [])
        except json.JSONDecodeError:
            # 如果解析失败，返回默认大纲
            outline = [
                {"title": "引言", "description": "文章引言部分"},
                {"title": "正文", "description": "文章主要内容"},
                {"title": "总结", "description": "文章总结部分"},
            ]

        # 记录步骤: 大纲生成完成
        if log_callback:
            log_callback("outline_generation_completed", {
                "sections_count": len(outline),
                "usage": model_result.get("usage", {})
            })

        return outline, model_result.get("usage", {})

    async def _generate_sections(
        self,
        model_adapter: ModelFactoryAdapter,
        model_name: str,
        system_prompt: str | None,
        outline: list[dict],
        params: dict,
        log_callback: Callable[[str, dict], None] | None = None,
    ) -> tuple[list[dict], dict]:
        """根据大纲生成各章节内容"""
        sections = []
        total_usage = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }

        # 记录步骤: 开始生成章节
        if log_callback:
            log_callback("sections_generation_started", {
                "total_sections": len(outline)
            })

        for idx, section_info in enumerate(outline):
            section_title = section_info.get("title", "")
            section_description = section_info.get("description", "")

            # 记录步骤: 开始生成单个章节
            if log_callback:
                log_callback("section_generation_started", {
                    "section_index": idx,
                    "section_title": section_title
                })

            # 生成章节内容
            section_prompt = f"请为以下章节撰写详细内容：\n\n章节标题：{section_title}\n章节描述：{section_description}\n\n请直接返回章节内容，不要包含标题。"

            model_result = await model_adapter.call_model(
                model_name=model_name,
                system_prompt=system_prompt,
                user_prompt=section_prompt,
            )

            sections.append(
                {
                    "title": section_title,
                    "content": model_result["content"],
                }
            )

            # 累加 usage
            usage = model_result.get("usage", {})
            total_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
            total_usage["completion_tokens"] += usage.get("completion_tokens", 0)
            total_usage["total_tokens"] += usage.get("total_tokens", 0)

            # 记录步骤: 单个章节生成完成
            if log_callback:
                log_callback("section_generation_completed", {
                    "section_index": idx,
                    "section_title": section_title,
                    "content_length": len(model_result["content"]),
                    "usage": usage
                })

        # 记录步骤: 所有章节生成完成
        if log_callback:
            log_callback("sections_generation_completed", {
                "total_sections": len(sections),
                "total_usage": total_usage
            })

        return sections, total_usage

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
