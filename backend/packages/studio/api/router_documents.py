from fastapi import APIRouter, Depends, HTTPException

from studio.api.deps import get_approval_service
from studio.models.dto import (
    ApprovalResponse,
    ApproveDocumentRequest,
    DocumentResponse,
    DocumentUpdateRequest,
    OkResponse,
    RagflowStatusResponse,
    RejectDocumentRequest,
    SubmitApprovalRequest,
)
from studio.services import ApprovalService

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


def _document_to_response(document: dict) -> DocumentResponse:
    """转换文档为响应"""
    rs_ids = document.get("runtimeSessionIds") or []
    runtime_session_ids = [str(x) for x in rs_ids] if rs_ids else None
    latest = document.get("latestRuntimeSessionId")
    return DocumentResponse(
        id=str(document["_id"]),
        title=document["title"],
        content_markdown=document["contentMarkdown"],
        summary=document.get("summary"),
        keywords=document.get("keywords", []),
        approval_status=document["approvalStatus"],
        ragflow_status=document["ragflowStatus"],
        version=document["version"],
        runtime_session_ids=runtime_session_ids,
        latest_runtime_session_id=str(latest) if latest else None,
    )


def _approval_to_response(approval: dict) -> ApprovalResponse:
    """转换审批记录为响应"""
    return ApprovalResponse(
        id=str(approval["_id"]),
        document_id=str(approval["documentId"]),
        approver_id=approval["approverId"],
        status=approval["status"],
        comment=approval.get("comment"),
        created_at=approval["createdAt"].isoformat(),
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    service: ApprovalService = Depends(get_approval_service),
):
    """获取文档详情"""
    document = await service.get_document(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return _document_to_response(document)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    template_id: str | None = None,
    approval_status: str | None = None,
    ragflow_status: str | None = None,
    skip: int = 0,
    limit: int = 20,
    service: ApprovalService = Depends(get_approval_service),
):
    """列表查询文档"""
    documents, _ = await service.list_documents(
        template_id=template_id,
        approval_status=approval_status,
        ragflow_status=ragflow_status,
        skip=skip,
        limit=limit,
    )
    return [_document_to_response(d) for d in documents]


@router.put("/{document_id}", response_model=OkResponse)
async def update_document(
    document_id: str,
    request: DocumentUpdateRequest,
    service: ApprovalService = Depends(get_approval_service),
):
    """更新文档内容"""
    try:
        await service.update_document(
            document_id=document_id,
            title=request.title,
            content_markdown=request.content_markdown,
            summary=request.summary,
            keywords=request.keywords,
        )
        return OkResponse()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{document_id}/submit-approval", response_model=OkResponse)
async def submit_approval(
    document_id: str,
    request: SubmitApprovalRequest,
    user_id: str = "default_user",  # TODO: 从认证信息获取
    service: ApprovalService = Depends(get_approval_service),
):
    """提交审批"""
    try:
        await service.submit_for_approval(
            document_id=document_id,
            user_id=user_id,
            comment=request.comment,
        )
        return OkResponse()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{document_id}/approve", response_model=OkResponse)
async def approve_document(
    document_id: str,
    request: ApproveDocumentRequest,
    user_id: str = "default_user",  # TODO: 从认证信息获取
    service: ApprovalService = Depends(get_approval_service),
):
    """审批通过"""
    try:
        await service.approve_document(
            document_id=document_id,
            approver_id=user_id,
            knowledgebase_id=request.knowledgebase_id,
            dataset_id=request.dataset_id,
            comment=request.comment,
        )
        return OkResponse()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{document_id}/reject", response_model=OkResponse)
async def reject_document(
    document_id: str,
    request: RejectDocumentRequest,
    user_id: str = "default_user",  # TODO: 从认证信息获取
    service: ApprovalService = Depends(get_approval_service),
):
    """审批驳回"""
    try:
        await service.reject_document(
            document_id=document_id,
            approver_id=user_id,
            comment=request.comment,
        )
        return OkResponse()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{document_id}/approvals", response_model=list[ApprovalResponse])
async def get_approval_history(
    document_id: str,
    skip: int = 0,
    limit: int = 20,
    service: ApprovalService = Depends(get_approval_service),
):
    """获取审批历史"""
    approvals, _ = await service.get_approval_history(
        document_id, skip=skip, limit=limit
    )
    return [_approval_to_response(a) for a in approvals]


@router.get("/{document_id}/ragflow-status", response_model=RagflowStatusResponse)
async def get_ragflow_status(
    document_id: str,
    service: ApprovalService = Depends(get_approval_service),
):
    """获取 RAGFlow 状态"""
    try:
        task = await service.get_ragflow_status(document_id)
        if not task:
            raise HTTPException(status_code=200 , detail="RAGFlow task not found")
        
        return RagflowStatusResponse(
            document_id=document_id,
            ragflow_status=task["status"],
            ragflow_document_id=task.get("ragflowDocumentId"),
            knowledgebase_id=str(task.get("knowledgebaseId", "")) if task.get("knowledgebaseId") else None,
            last_error=task.get("lastError"),
        )
    except ValueError as e:
        raise HTTPException(status_code=200 , detail=str(e))


@router.post("/{document_id}/ragflow-retry", response_model=OkResponse)
async def retry_ragflow_indexing(
    document_id: str,
    service: ApprovalService = Depends(get_approval_service),
):
    """重试 RAGFlow 索引"""
    try:
        await service.retry_ragflow_indexing(document_id)
        return OkResponse()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
