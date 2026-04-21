"""从 Job + 模板构建 DeerFlow runtime 请求（消息与 requestContext）。"""

from __future__ import annotations

from typing import Any

from studio.repositories import TemplateRepository, TemplateVersionRepository
from studio.services.prompt_render_service import PromptRenderService
from studio.settings import StudioSettings


class ArticlePromptBuildService:
    def __init__(self) -> None:
        self.template_repo = TemplateRepository()
        self.version_repo = TemplateVersionRepository()
        self.prompt_service = PromptRenderService()

    async def build_runtime_request_from_job(self, job: dict[str, Any]) -> dict[str, Any]:
        template = await self.template_repo.find_by_id(str(job["templateId"]))
        if not template:
            raise ValueError("Template not found")
        version = await self.version_repo.find_latest_version(str(job["templateId"]))
        if not version:
            raise ValueError("Template version not found")

        schema = version.get("schema") or {}
        user_prompt_tpl = version.get("userPromptTemplate") or ""
        params = job.get("inputParams") or {}
        text, err = self.prompt_service.validate_and_render(schema, user_prompt_tpl, params)
        if err or not text:
            raise ValueError(err or "failed to render prompt")

        system_prompt = version.get("systemPrompt") or ""
        if system_prompt:
            text = text + "\n" + system_prompt

        # DeerFlow 的前端会在 context 中携带 agent_name + model_name 等字段用于选择智能体/模型。
        # Studio 侧不让用户在模板中选择 agentName，统一从配置读取。
        settings = StudioSettings()
        agent_name = settings.deerflow_agent_name
        model_name = job.get("modelName") or version.get("defaultModelName") or "gpt-4o"
        mode = settings.deerflow_mode
        reasoning_effort = version.get("reasoningEffort") or settings.deerflow_reasoning_effort
        rc = {
            "agentName": agent_name,
            "modelName": model_name,
            "mode": mode,
            "reasoningEffort": reasoning_effort,
            "thinkingEnabled": True,
            "planMode": True,
            "subagentEnabled": False,
        }
        return {"message": text, "request_context": rc}
