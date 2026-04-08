from .common_dto import OkResponse, IdResponse
from .template_dto import (
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateVersionCreateRequest,
    TemplateResponse,
    TemplateVersionResponse,
)
from .job_dto import JobCreateRequest, JobResponse, JobDetailResponse
from .document_dto import (
    DocumentResponse,
    DocumentUpdateRequest,
    SubmitApprovalRequest,
    ApproveDocumentRequest,
    RejectDocumentRequest,
    ApprovalResponse,
)

__all__ = [
    "OkResponse",
    "IdResponse",
    "TemplateCreateRequest",
    "TemplateUpdateRequest",
    "TemplateVersionCreateRequest",
    "TemplateResponse",
    "TemplateVersionResponse",
    "JobCreateRequest",
    "JobResponse",
    "JobDetailResponse",
    "DocumentResponse",
    "DocumentUpdateRequest",
    "SubmitApprovalRequest",
    "ApproveDocumentRequest",
    "RejectDocumentRequest",
    "ApprovalResponse",
]
