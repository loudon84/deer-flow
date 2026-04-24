"""
RAGFlow 服务诊断脚本
用于检查 RAGFlow 服务的状态和可用 API 端点
"""
import asyncio
import httpx
import os
import json

# 配置
BASE_URL = os.getenv("ARTICLE_STUDIO_RAGFLOW_BASE_URL", "http://192.168.102.247:9222")
API_KEY = os.getenv("ARTICLE_STUDIO_RAGFLOW_API_KEY", "ragflow-GC48uXGSDLkEO_ENhtxtWUqZ5zKcLlbm_6XghbZCGCo")

headers = {"Authorization": f"Bearer {API_KEY}"}

# 常见的 API 路径模式
API_PATHS_TO_TEST = [
    # v1 API
    "/api/v1/knowledgebases",
    "/api/v1/datasets",
    "/api/v1/documents",
    "/api/v1/chunks",
    "/v1/knowledgebases",
    "/v1/datasets",
    # 其他可能的路径
    "/api/knowledgebases",
    "/api/datasets",
    "/api/documents",
    "/knowledgebases",
    "/datasets",
    # OpenAPI/Swagger
    "/openapi.json",
    "/docs",
    "/api/docs",
    # 根路径
    "/",
    "/api",
    "/v1",
]


async def test_path(client: httpx.AsyncClient, path: str) -> dict:
    """测试单个路径"""
    try:
        url = f"{BASE_URL}{path}"
        response = await client.get(url, headers=headers, timeout=5.0)

        result = {
            "path": path,
            "status": response.status_code,
            "success": response.status_code < 400,
            "content_type": response.headers.get("content-type", "unknown"),
            "content_preview": response.text[:200] if response.text else ""
        }

        # 尝试解析 JSON
        if "application/json" in response.headers.get("content-type", ""):
            try:
                result["json_data"] = response.json()
            except:
                pass

        return result

    except Exception as e:
        return {
            "path": path,
            "status": "ERROR",
            "success": False,
            "error": str(e)
        }


async def main():
    print("=" * 80)
    print("RAGFlow 服务诊断工具")
    print("=" * 80)
    print(f"\n目标服务: {BASE_URL}")
    print(f"API Key: {API_KEY[:20]}...")
    print("\n正在测试各种 API 路径...\n")

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 测试所有可能的路径
        results = []
        for path in API_PATHS_TO_TEST:
            result = await test_path(client, path)
            results.append(result)

        # 显示结果
        print("测试结果:")
        print("-" * 80)

        successful_paths = []
        for result in results:
            status_icon = "✓" if result["success"] else "✗"
            status = result["status"]
            path = result["path"]

            print(f"{status_icon} {path:40} Status: {status}")

            if result["success"]:
                successful_paths.append(path)
                if "content_preview" in result and result["content_preview"]:
                    print(f"  Preview: {result['content_preview']}")
                if "json_data" in result:
                    data = result["json_data"]
                    if isinstance(data, dict) and "data" in data:
                        print(f"  Data keys: {list(data.keys())}")
                        if isinstance(data["data"], list) and len(data["data"]) > 0:
                            print(f"  Sample item: {json.dumps(data['data'][0], indent=2)[:200]}")
            elif "error" in result:
                print(f"  Error: {result['error']}")

            print()

        # 总结
        print("=" * 80)
        print("诊断总结:")
        print("=" * 80)
        print(f"找到 {len(successful_paths)} 个可用的 API 端点:")

        for path in successful_paths:
            print(f"  - {path}")

        if not successful_paths:
            print("\n⚠️  未找到任何可用的 API 端点！")
            print("\n可能的原因:")
            print("1. RAGFlow 服务未正常运行")
            print("2. API Key 不正确或无权限")
            print("3. 服务地址配置错误")
            print("4. RAGFlow 版本与代码不兼容")
            print("\n建议:")
            print("1. 检查 RAGFlow 服务是否正常运行: curl " + BASE_URL)
            print("2. 检查 RAGFlow 日志")
            print("3. 确认 API Key 是否正确")
            print("4. 查看 RAGFlow 文档确认正确的 API 路径")

        # 如果找到了知识库相关的端点，提供进一步的建议
        kb_paths = [p for p in successful_paths if "knowledgebase" in p.lower()]
        if kb_paths:
            print(f"\n✓ 找到知识库相关端点，建议使用: {kb_paths[0]}")
            print(f"  更新配置: export ARTICLE_STUDIO_RAGFLOW_BASE_URL={BASE_URL}")
            print(f"  当前代码中的路径需要调整为匹配实际的 API 路径")


if __name__ == "__main__":
    asyncio.run(main())
