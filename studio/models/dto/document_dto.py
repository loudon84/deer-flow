from pydantic import BaseModel


class DocumentResponse(BaseModel):
    """文档响应"""

    id: str
    title: str
    content_markdown: str
    summary: str | None = None
    keywords: list[str]
    approval_status: str
    ragflow_status: str
    version: int
    job_id: str | None = None
    runtime_session_ids: list[str] | None = None
    latest_runtime_session_id: str | None = None


class DocumentUpdateRequest(BaseModel):
    """文档更新请求"""

    title: str | None = None
    content_markdown: str
    summary: str | None = None
    keywords: list[str] | None = None


class SubmitApprovalRequest(BaseModel):
    """提交审批请求"""

    comment: str | None = None


class ApproveDocumentRequest(BaseModel):
    """审批通过请求"""

    comment: str | None = None
    knowledgebase_id: str
    dataset_id: str | None = None


class RejectDocumentRequest(BaseModel):
    """审批驳回请求"""

    comment: str


class ApprovalResponse(BaseModel):
    """审批记录响应"""

    id: str
    document_id: str
    approver_id: str
    status: str
    comment: str | None = None
    created_at: str


class RagflowStatusResponse(BaseModel):
    """RAGFlow 状态响应"""

    document_id: str
    ragflow_status: str
    ragflow_document_id: str | None = None
    knowledgebase_id: str | None = None
    last_error: str | None = None
