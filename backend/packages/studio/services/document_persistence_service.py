"""文档落盘（runtime 结果 -> article_documents）。"""

from __future__ import annotations

from typing import Any

from studio.repositories import DocumentRepository, JobRepository


class DocumentPersistenceService:
    def __init__(self) -> None:
        self.document_repo = DocumentRepository()
        self.job_repo = JobRepository()

    async def persist_job_result_as_document(self, *, job: dict[str, Any], result: dict[str, Any]) -> str:
        template_id = str(job["templateId"])
        job_id = str(job["_id"])
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
            },
        )
        await self.job_repo.set_succeeded(job_id, doc_id)
        return doc_id
