import httpx
from article_studio.settings import RagflowSettings


class RagflowClient:
    """RAGFlow 客户端"""

    def __init__(self):
        self.settings = RagflowSettings()
        self.headers = {"Authorization": f"Bearer {self.settings.api_key}"}

    async def _request(
        self, method: str, path: str, **kwargs
    ) -> dict:
        """发送请求"""
        url = f"{self.settings.base_url}{path}"
        kwargs["headers"] = self.headers
        kwargs["timeout"] = self.settings.timeout_seconds

        async with httpx.AsyncClient() as client:
            response = await client.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()

    async def create_knowledgebase(
        self, name: str, description: str | None = None
    ) -> dict:
        """创建知识库"""
        data = {"name": name}
        if description:
            data["description"] = description

        return await self._request("POST", "/api/v1/knowledgebases", json=data)

    async def get_knowledgebase(self, knowledgebase_id: str) -> dict:
        """获取知识库信息"""
        return await self._request(
            "GET", f"/api/v1/knowledgebases/{knowledgebase_id}"
        )

    async def list_knowledgebases(self) -> list[dict]:
        """列出所有知识库"""
        result = await self._request("GET", "/api/v1/knowledgebases")
        return result.get("data", [])

    async def upload_document(
        self,
        knowledgebase_id: str,
        document_name: str,
        content: str,
        dataset_id: str | None = None,
    ) -> dict:
        """上传文档到知识库"""
        data = {
            "knowledgebase_id": knowledgebase_id,
            "name": document_name,
            "content": content,
        }
        if dataset_id:
            data["dataset_id"] = dataset_id

        return await self._request(
            "POST", f"/api/v1/knowledgebases/{knowledgebase_id}/documents", json=data
        )

    async def get_document_status(
        self, knowledgebase_id: str, document_id: str
    ) -> dict:
        """获取文档状态"""
        return await self._request(
            "GET",
            f"/api/v1/knowledgebases/{knowledgebase_id}/documents/{document_id}",
        )

    async def delete_document(
        self, knowledgebase_id: str, document_id: str
    ) -> dict:
        """删除文档"""
        return await self._request(
            "DELETE",
            f"/api/v1/knowledgebases/{knowledgebase_id}/documents/{document_id}",
        )

    async def search(
        self,
        knowledgebase_id: str,
        query: str,
        top_k: int = 10,
    ) -> list[dict]:
        """搜索知识库"""
        data = {
            "knowledgebase_id": knowledgebase_id,
            "query": query,
            "top_k": top_k,
        }
        result = await self._request(
            "POST", f"/api/v1/knowledgebases/{knowledgebase_id}/search", json=data
        )
        return result.get("data", [])
