import httpx
import logging
import tempfile
import os
from studio.settings import RagflowSettings

logger = logging.getLogger(__name__)


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

        logger.info(f"RAGFlow API Request: {method} {url}")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(method, url, **kwargs)
                logger.info(f"RAGFlow API Response: {response.status_code}")

                if response.status_code >= 400:
                    error_detail = response.text
                    logger.error(f"RAGFlow API Error: {response.status_code} - {error_detail}")

                    # 提供更详细的错误信息
                    if response.status_code == 404:
                        raise ValueError(
                            f"RAGFlow API 路径不存在: {path}\n"
                            f"完整 URL: {url}\n"
                            f"请检查:\n"
                            f"1. RAGFlow 服务是否正常运行在 {self.settings.base_url}\n"
                            f"2. API 路径是否正确\n"
                            f"3. 知识库 ID 是否存在\n"
                            f"错误详情: {error_detail}"
                        )
                    elif response.status_code == 401:
                        raise ValueError(
                            f"RAGFlow API 认证失败\n"
                            f"请检查 API Key 是否正确: {self.settings.api_key[:20]}..."
                        )
                    else:
                        raise ValueError(
                            f"RAGFlow API 请求失败: {response.status_code}\n"
                            f"错误详情: {error_detail}"
                        )

                response.raise_for_status()
                return response.json()

            except httpx.HTTPStatusError as e:
                logger.error(f"RAGFlow HTTP Error: {e}")
                raise
            except httpx.ConnectError as e:
                logger.error(f"RAGFlow Connection Error: {e}")
                raise ValueError(
                    f"无法连接到 RAGFlow 服务: {self.settings.base_url}\n"
                    f"请检查 RAGFlow 服务是否正常运行"
                )
            except Exception as e:
                logger.error(f"RAGFlow Request Error: {e}")
                raise

    async def create_knowledgebase(
        self, name: str, description: str | None = None
    ) -> dict:
        """创建知识库（实际上是 dataset）"""
        data = {"name": name}
        if description:
            data["description"] = description

        return await self._request("POST", "/api/v1/datasets", json=data)

    async def get_knowledgebase(self, knowledgebase_id: str) -> dict:
        """获取知识库信息（实际上是 dataset）"""
        return await self._request(
            "GET", f"/api/v1/datasets/{knowledgebase_id}"
        )

    async def list_knowledgebases(self) -> list[dict]:
        """列出所有知识库（实际上是 datasets）"""
        result = await self._request("GET", "/api/v1/datasets")
        return result.get("data", [])

    async def upload_document(
        self,
        knowledgebase_id: str,
        document_name: str,
        content: str,
        dataset_id: str | None = None,
    ) -> dict:
        """上传文档到知识库

        根据 RAGFlow v0.24.0 API 文档，上传文档需要：
        1. 使用 /api/v1/datasets/{dataset_id}/documents 端点
        2. 使用 multipart/form-data 格式
        3. 上传 Markdown 格式文件

        注意：系统只支持 text/markdown 格式
        """
        # 使用 dataset_id 或 knowledgebase_id
        dataset_id_to_use = dataset_id or knowledgebase_id

        logger.info(f"Uploading document to RAGFlow: dataset_id={dataset_id_to_use}, name={document_name}")

        # 创建临时 Markdown 文件
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.md',
                delete=False,
                encoding='utf-8'
            ) as temp_file:
                temp_file.write(content)
                temp_file_path = temp_file.name

            # 使用 multipart/form-data 上传文件
            url = f"{self.settings.base_url}/api/v1/datasets/{dataset_id_to_use}/documents"

            logger.info(f"RAGFlow API Request: POST {url}")

            async with httpx.AsyncClient() as client:
                with open(temp_file_path, 'rb') as f:
                    files = {
                        'file': (f"{document_name}.md", f, 'text/markdown')
                    }
                    response = await client.post(
                        url,
                        headers={"Authorization": self.headers["Authorization"]},
                        files=files,
                        timeout=self.settings.timeout_seconds
                    )

                logger.info(f"RAGFlow API Response: {response.status_code} - {response.text[:200]}")

                if response.status_code >= 400:
                    error_detail = response.text
                    logger.error(f"RAGFlow API Error: {response.status_code} - {error_detail}")
                    raise ValueError(
                        f"RAGFlow API 请求失败: {response.status_code}\n"
                        f"错误详情: {error_detail}"
                    )

                response.raise_for_status()
                result = response.json()

                logger.info(f"Document uploaded successfully: {result}")
                return result

        except Exception as e:
            logger.error(f"Failed to upload document: {e}")
            raise
        finally:
            # 删除临时文件
            if temp_file_path:
                try:
                    os.unlink(temp_file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary file: {e}")

    async def get_document_status(
        self, knowledgebase_id: str, document_id: str
    ) -> dict:
        """获取文档状态"""
        return await self._request(
            "GET",
            f"/v1/document/{document_id}",
        )

    async def delete_document(
        self, knowledgebase_id: str, document_id: str
    ) -> dict:
        """删除文档"""
        return await self._request(
            "POST",
            f"/v1/document/rm",
            json={"document_ids": [document_id]}
        )

    async def search(
        self,
        knowledgebase_id: str,
        query: str,
        top_k: int = 10,
    ) -> list[dict]:
        """搜索知识库"""
        data = {
            "kb_id": knowledgebase_id,
            "question": query,
            "top_k": top_k,
        }
        result = await self._request(
            "POST", f"/v1/retrieval", json=data
        )
        return result.get("data", [])
