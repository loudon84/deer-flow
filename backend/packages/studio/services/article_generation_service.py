from bson import ObjectId
from studio.repositories import (
    TemplateRepository,
    TemplateVersionRepository,
    JobRepository,
    DocumentRepository,
)
from studio.integrations import ModelFactoryAdapter
from studio.services.strategy import get_strategy_registry
from studio.services.prompt_render_service import PromptRenderService
from studio.models.persistence import (
    TEMPLATE_STATUS_ACTIVE,
    JOB_STATUS_QUEUED,
)


class ArticleGenerationService:
    """文章生成服务"""

    def __init__(self):
        self.template_repo = TemplateRepository()
        self.version_repo = TemplateVersionRepository()
        self.job_repo = JobRepository()
        self.document_repo = DocumentRepository()
        self.prompt_service = PromptRenderService()
        self.model_adapter = ModelFactoryAdapter()
        self.strategy_registry = get_strategy_registry()

    async def create_job(
        self,
        template_id: str,
        user_id: str,
        title: str,
        input_params: dict,
        generation_mode: str | None = None,
        model_name: str | None = None,
        prompt_override: str | None = None,
    ) -> str:
        """创建生成任务"""
        # 验证模板
        template = await self.template_repo.find_by_id(template_id)
        if not template:
            raise ValueError("Template not found")

        if template["status"] != TEMPLATE_STATUS_ACTIVE:
            raise ValueError("Template is not active")

        # 获取最新版本
        latest_version = await self.version_repo.find_latest_version(template_id)
        if not latest_version:
            raise ValueError("Template has no versions")

        # 验证输入参数
        schema = latest_version["schema"]
        is_valid, error = self.prompt_service.validate_params(schema, input_params)
        if not is_valid:
            raise ValueError(f"Invalid input parameters: {error}")

        # 确定生成模式和模型
        final_generation_mode = generation_mode or latest_version["defaultGenerationMode"]
        final_model_name = model_name or latest_version["defaultModelName"]

        # 验证生成模式
        if not self.strategy_registry.has_strategy(final_generation_mode):
            raise ValueError(f"Unknown generation mode: {final_generation_mode}")

        # 创建任务
        job_data = {
            "templateId": ObjectId(template_id),
            "userId": user_id,
            "title": title,
            "inputParams": input_params,
            "generationMode": final_generation_mode,
            "modelName": final_model_name,
            "promptOverride": prompt_override,
        }

        return await self.job_repo.create(job_data)

    async def get_job(self, job_id: str) -> dict | None:
        """获取任务详情"""
        return await self.job_repo.find_by_id(job_id)

    async def get_job_work_logs(self, job_id: str) -> list[dict] | None:
        """获取任务工作日志

        Args:
            job_id: 任务ID

        Returns:
            工作日志列表,每个日志包含 step, timestamp, details 字段
        """
        job = await self.job_repo.find_by_id(job_id)
        if not job:
            return None
        return job.get("workLogs", [])

    async def get_job_tokens_usage(self, job_id: str) -> dict | None:
        """获取任务 tokens 使用量

        Args:
            job_id: 任务ID

        Returns:
            tokens 使用信息,包含 totalPromptTokens, totalCompletionTokens, totalTokens
        """
        job = await self.job_repo.find_by_id(job_id)
        if not job:
            return None

        return {
            "totalPromptTokens": job.get("totalPromptTokens", 0),
            "totalCompletionTokens": job.get("totalCompletionTokens", 0),
            "totalTokens": job.get("totalTokens", 0),
        }

    async def list_jobs(
        self,
        user_id: str | None = None,
        template_id: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[dict], int]:
        """列表查询任务"""
        jobs = await self.job_repo.find_list(
            user_id=user_id,
            template_id=template_id,
            status=status,
            skip=skip,
            limit=limit,
        )
        total = await self.job_repo.count(
            user_id=user_id, template_id=template_id, status=status
        )
        return jobs, total

    async def cancel_job(self, job_id: str) -> bool:
        """取消任务"""
        return await self.job_repo.cancel(job_id)

    async def execute_job(self, job_id: str) -> str:
        """执行生成任务（由 Worker 调用）"""
        # 获取任务
        job = await self.job_repo.find_by_id(job_id)
        if not job:
            raise ValueError("Job not found")

        # 设置为运行中
        await self.job_repo.set_running(job_id)

        # 记录工作日志的回调函数
        async def log_callback(step: str, details: dict):
            await self.job_repo.add_work_log(job_id, step, details)

        try:
            # 记录步骤: 任务开始
            await log_callback("job_started", {
                "template_id": str(job["templateId"]),
                "generation_mode": job["generationMode"],
                "model_name": job.get("modelName")
            })

            # 获取模板和版本
            template = await self.template_repo.find_by_id(str(job["templateId"]))
            template_version = await self.version_repo.find_latest_version(
                str(job["templateId"])
            )

            if not template or not template_version:
                raise ValueError("Template or version not found")

            # 记录步骤: 模板加载完成
            await log_callback("template_loaded", {
                "template_name": template.get("name"),
                "version_id": str(template_version["_id"])
            })

            # 获取生成策略
            strategy = self.strategy_registry.get(job["generationMode"])
            if not strategy:
                raise ValueError(f"Strategy not found: {job['generationMode']}")

            # 记录步骤: 策略选择完成
            await log_callback("strategy_selected", {
                "strategy_name": strategy.name
            })

            # 执行生成
            result = await strategy.execute(
                template=template,
                template_version=template_version,
                params=job["inputParams"],
                model_adapter=self.model_adapter,
                log_callback=log_callback,
            )

            # 记录 tokens 使用量
            usage = result.get("usage", {})
            if usage:
                await self.job_repo.update_tokens_usage(job_id, usage)
                await log_callback("tokens_recorded", {
                    "usage": usage
                })

            # 创建文档
            document_data = {
                "jobId": ObjectId(job_id),
                "templateId": ObjectId(str(job["templateId"])),
                "title": result["title"],
                "contentMarkdown": result["contentMarkdown"],
                "summary": result.get("summary"),
                "keywords": result.get("keywords", []),
            }
            document_id = await self.document_repo.create(document_data)

            # 记录步骤: 文档创建完成
            await log_callback("document_created", {
                "document_id": document_id,
                "title": result["title"]
            })

            # 更新任务状态
            await self.job_repo.set_succeeded(job_id, document_id)

            # 记录步骤: 任务完成
            await log_callback("job_completed", {
                "document_id": document_id
            })

            return document_id

        except Exception as e:
            # 记录错误
            error_msg = str(e)
            await self.job_repo.set_failed(job_id, error_msg)

            # 记录步骤: 任务失败
            try:
                await log_callback("job_failed", {
                    "error": error_msg
                })
            except Exception:
                pass  # 忽略日志记录失败

            raise

    async def retry_job(self, job_id: str) -> str:
        """重试任务"""
        job = await self.job_repo.find_by_id(job_id)
        if not job:
            raise ValueError("Job not found")

        # 创建新任务
        return await self.create_job(
            template_id=str(job["templateId"]),
            user_id=job["userId"],
            title=job["title"],
            input_params=job["inputParams"],
            generation_mode=job.get("generationMode"),
            model_name=job.get("modelName"),
            prompt_override=job.get("promptOverride"),
        )
