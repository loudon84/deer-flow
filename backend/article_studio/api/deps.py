from functools import lru_cache
from article_studio.services import (
    TemplateService,
    ArticleGenerationService,
    ApprovalService,
    RagflowIngestionService,
)


@lru_cache(maxsize=1)
def get_template_service() -> TemplateService:
    """获取模板服务"""
    return TemplateService()


@lru_cache(maxsize=1)
def get_generation_service() -> ArticleGenerationService:
    """获取生成服务"""
    return ArticleGenerationService()


@lru_cache(maxsize=1)
def get_approval_service() -> ApprovalService:
    """获取审批服务"""
    return ApprovalService()


@lru_cache(maxsize=1)
def get_ragflow_service() -> RagflowIngestionService:
    """获取 RAGFlow 服务"""
    return RagflowIngestionService()
