from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from studio.domain.runtime.adapters import DeerFlowAdapter
from studio.domain.runtime.dto import (
    ApplyRuntimeResultRequest,
    ApplyRuntimeResultResponse,
    LatestRuntimeResultResponse,
)
from studio.domain.runtime.mappers import RuntimeResultMapper
from studio.repositories import DocumentRepository, JobRepository, RuntimeSessionRepository


class RuntimeResultService:
    """结果物化与应用到文档"""

    def __init__(
        self,
        session_repo: RuntimeSessionRepository | None = None,
        adapter: DeerFlowAdapter | None = None,
        mapper: RuntimeResultMapper | None = None,
        document_repo: DocumentRepository | None = None,
        job_repo: JobRepository | None = None,
    ) -> None:
        self.session_repo = session_repo or RuntimeSessionRepository()
        self.adapter = adapter
        self.mapper = mapper or RuntimeResultMapper()
        self.document_repo = document_repo or DocumentRepository()
        self.job_repo = job_repo or JobRepository()

    def set_adapter(self, adapter: DeerFlowAdapter) -> None:
        self.adapter = adapter

    async def materialize_latest_result(self, session_id: str) -> dict[str, Any] | None:
        if self.adapter is None:
            raise RuntimeError("adapter not set")
        session = await self.session_repo.find_by_id(session_id)
        if not session:
            return None
        thread_id = session["threadId"]
        state = await self.adapter.get_thread_state(thread_id=thread_id)
        out = self.mapper.from_thread_state(state)
        if not out:
            hist = await self.adapter.get_thread_history(thread_id=thread_id, limit=30)
            out = self.mapper.from_history_entries(hist)
        if not out:
            return None
        rid = out.get("resultId") or f"res_{uuid.uuid4().hex[:12]}"
        payload = {
            "resultId": rid,
            "resultType": out.get("resultType", "article_draft"),
            "title": out.get("title"),
            "content": out.get("content"),
            "createdAt": datetime.utcnow().isoformat() + "Z",
        }
        await self.session_repo.set_materialized_result(session_id, payload)
        await self.session_repo.patch_summary_fields(
            session_id,
            {
                "latestResultType": payload["resultType"],
                "latestResultId": rid,
            },
        )
        return payload

    async def get_latest_result(self, session_id: str) -> LatestRuntimeResultResponse | None:
        session = await self.session_repo.find_by_id(session_id)
        if not session:
            return None
        mat = session.get("materializedResult")
        if not mat:
            return None
        return LatestRuntimeResultResponse(
            resultId=mat["resultId"],
            resultType=mat.get("resultType", "article_draft"),
            title=mat.get("title"),
            content=mat.get("content"),
            createdAt=mat.get("createdAt"),
        )

    async def apply_result_to_document(
        self,
        document_id: str,
        result_id: str,
        body: ApplyRuntimeResultRequest,
    ) -> ApplyRuntimeResultResponse:
        doc = await self.document_repo.find_by_id(document_id)
        if not doc:
            raise ValueError("document not found")
        session_id = None
        if doc.get("latestRuntimeSessionId"):
            session_id = str(doc["latestRuntimeSessionId"])
        elif doc.get("runtimeSessionIds"):
            arr = doc["runtimeSessionIds"]
            session_id = str(arr[-1]) if arr else None
        if not session_id:
            raise ValueError("no runtime session on document")
        session = await self.session_repo.find_by_id(session_id)
        if not session:
            raise ValueError("session not found")
        mat = session.get("materializedResult") or {}
        if mat.get("resultId") != result_id:
            # 允许仅最新结果
            raise ValueError("result_id mismatch")
        content = mat.get("content") or ""
        title = mat.get("title")
        ok, ver = await self.document_repo.apply_runtime_result(
            document_id,
            title=title,
            content_markdown=content,
            apply_mode=body.apply_mode,
        )
        if not ok:
            raise ValueError("apply failed")
        return ApplyRuntimeResultResponse(
            documentId=document_id,
            applied=True,
            applyMode=body.apply_mode,
            newVersion=ver,
        )

    async def persist_job_success_document(
        self,
        session_id: str,
        *,
        job_id: str,
        result: dict[str, Any],
    ) -> str | None:
        """Job 完成后从物化结果创建 article_documents 并标记 job 成功。"""
        job = await self.job_repo.find_by_id(job_id)
        if not job:
            return None
        template_id = str(job["templateId"])
        doc_id = await self.document_repo.create_from_runtime_result(
            job_id=job_id,
            template_id=template_id,
            title=result.get("title") or "未命名文档",
            content_markdown=result.get("content") or "",
            summary=None,
            keywords=[],
            metadata={
                "source": "deerflow",
                "runtimeResultType": result.get("resultType"),
                "runtimeSessionId": session_id,
            },
        )
        await self.job_repo.set_succeeded(job_id, doc_id)
        return doc_id
