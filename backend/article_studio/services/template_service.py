from bson import ObjectId
from article_studio.repositories import (
    TemplateRepository,
    TemplateVersionRepository,
)
from article_studio.models.persistence import (
    TEMPLATE_STATUS_ACTIVE,
    TEMPLATE_STATUS_INACTIVE,
    TEMPLATE_STATUS_ARCHIVED,
)


class TemplateService:
    """模板服务"""

    def __init__(self):
        self.template_repo = TemplateRepository()
        self.version_repo = TemplateVersionRepository()

    async def create_template(self, data: dict) -> str:
        """创建模板"""
        # 检查 code 是否已存在
        existing = await self.template_repo.find_by_code(data["code"])
        if existing:
            raise ValueError(f"Template with code '{data['code']}' already exists")

        # 创建模板
        template_id = await self.template_repo.create(data)

        # 创建第一个版本
        version_data = {
            "templateId": ObjectId(template_id),
            "version": 1,
            "schema": data["schema"],
            "systemPrompt": data.get("system_prompt"),
            "userPromptTemplate": data["user_prompt_template"],
            "defaultModelName": data["default_model_name"],
            "defaultGenerationMode": data["default_generation_mode"],
            "exampleInput": None,
            "exampleOutput": None,
        }
        await self.version_repo.create(version_data)

        return template_id

    async def get_template(self, template_id: str) -> dict | None:
        """获取模板详情"""
        template = await self.template_repo.find_by_id(template_id)
        if not template:
            return None

        # 获取最新版本信息
        latest_version = await self.version_repo.find_latest_version(template_id)
        if latest_version:
            template["defaultModelName"] = latest_version.get("defaultModelName")
            template["defaultGenerationMode"] = latest_version.get(
                "defaultGenerationMode"
            )

        return template

    async def list_templates(
        self,
        status: str | None = None,
        category: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[dict], int]:
        """列表查询模板"""
        templates = await self.template_repo.find_list(
            status=status, category=category, skip=skip, limit=limit
        )
        total = await self.template_repo.count(status=status, category=category)
        return templates, total

    async def update_template(self, template_id: str, data: dict) -> bool:
        """更新模板"""
        template = await self.template_repo.find_by_id(template_id)
        if not template:
            raise ValueError("Template not found")

        # 更新模板基本信息
        update_data = {}
        if "name" in data:
            update_data["name"] = data["name"]
        if "description" in data:
            update_data["description"] = data["description"]
        if "category" in data:
            update_data["category"] = data["category"]
        if "tags" in data:
            update_data["tags"] = data["tags"]
        if "status" in data:
            update_data["status"] = data["status"]

        if update_data:
            await self.template_repo.update(template_id, update_data)

        return True

    async def delete_template(self, template_id: str) -> bool:
        """删除模板"""
        # TODO: 检查是否有任务正在使用该模板
        return await self.template_repo.delete(template_id)

    async def create_version(self, template_id: str, data: dict) -> int:
        """创建模板版本"""
        template = await self.template_repo.find_by_id(template_id)
        if not template:
            raise ValueError("Template not found")

        # 获取最新版本号
        latest_version = await self.version_repo.find_latest_version(template_id)
        next_version = (latest_version["version"] + 1) if latest_version else 1

        # 创建新版本
        version_data = {
            "templateId": ObjectId(template_id),
            "version": next_version,
            "schema": data["schema"],
            "systemPrompt": data.get("system_prompt"),
            "userPromptTemplate": data["user_prompt_template"],
            "defaultModelName": data["default_model_name"],
            "defaultGenerationMode": data["default_generation_mode"],
            "exampleInput": data.get("example_input"),
            "exampleOutput": data.get("example_output"),
        }
        await self.version_repo.create(version_data)

        # 更新模板的当前版本号
        await self.template_repo.increment_version(template_id)

        return next_version

    async def get_version(self, template_id: str, version: int) -> dict | None:
        """获取特定版本"""
        return await self.version_repo.find_by_template_and_version(
            template_id, version
        )

    async def list_versions(
        self, template_id: str, skip: int = 0, limit: int = 20
    ) -> tuple[list[dict], int]:
        """获取模板版本列表"""
        versions = await self.version_repo.find_list_by_template(
            template_id, skip=skip, limit=limit
        )
        total = await self.version_repo.count_by_template(template_id)
        return versions, total
