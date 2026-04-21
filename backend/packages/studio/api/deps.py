from functools import lru_cache

from studio.domain.runtime.services.runtime_event_service import RuntimeEventService
from studio.domain.runtime.services.runtime_facade_service import RuntimeFacadeService
from studio.domain.runtime.services.runtime_hitl_service import RuntimeHitlService
from studio.domain.runtime.services.runtime_result_service import RuntimeResultService
from studio.services import (
    ApprovalService,
    ArticleGenerationService,
    RagflowIngestionService,
    TemplateService,
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


@lru_cache(maxsize=1)
def _runtime_facade_singleton() -> RuntimeFacadeService:
    return RuntimeFacadeService()


def get_runtime_facade_service() -> RuntimeFacadeService:
    return _runtime_facade_singleton()


def get_runtime_event_service() -> RuntimeEventService:
    return _runtime_facade_singleton().event_service


def get_runtime_hitl_service() -> RuntimeHitlService:
    return _runtime_facade_singleton().hitl_service


def get_runtime_result_service() -> RuntimeResultService:
    return _runtime_facade_singleton().result_service
