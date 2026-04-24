"""
直接测试 RAGFlow API 连接
"""
import asyncio
import httpx
import os

# 从环境变量获取配置
BASE_URL = os.getenv("ARTICLE_STUDIO_RAGFLOW_BASE_URL", "http://192.168.102.247:9222")
API_KEY = os.getenv("ARTICLE_STUDIO_RAGFLOW_API_KEY", "ragflow-GC48uXGSDLkEO_ENhtxtWUqZ5zKcLlbm_6XghbZCGCo")
KNOWLEDGEBASE_ID = os.getenv("ARTICLE_STUDIO_RAGFLOW_KNOWLEDGEBASE_ID", "68b2566a333011f1949e15c1295af575")

headers = {"Authorization": f"Bearer {API_KEY}"}


async def test_connection():
    """测试 API 连接"""
    print("=" * 60)
    print("RAGFlow API 连接测试")
    print("=" * 60)

    print(f"\n配置信息:")
    print(f"  Base URL: {BASE_URL}")
    print(f"  API Key: {API_KEY[:20]}...")
    print(f"  Knowledgebase ID: {KNOWLEDGEBASE_ID}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # 1. 测试基本连接
            print(f"\n1. 测试基本连接...")
            response = await client.get(f"{BASE_URL}/health", headers=headers)
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                print(f"   ✓ RAGFlow 服务运行正常")
                print(f"   Response: {response.text[:200]}")
            else:
                print(f"   Response: {response.text}")

        except Exception as e:
            print(f"   ✗ 连接失败: {e}")
            print(f"\n   请检查 RAGFlow 服务是否运行在 {BASE_URL}")

        try:
            # 2. 列出所有知识库
            print(f"\n2. 列出所有知识库...")
            response = await client.get(
                f"{BASE_URL}/api/v1/knowledgebases",
                headers=headers
            )
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                kbs = data.get("data", [])
                print(f"   ✓ 找到 {len(kbs)} 个知识库:")
                for kb in kbs:
                    kb_id = kb.get('id', kb.get('knowledgebase_id', 'N/A'))
                    kb_name = kb.get('name', 'N/A')
                    print(f"   - ID: {kb_id}, Name: {kb_name}")
            else:
                print(f"   ✗ 获取知识库列表失败")
                print(f"   Response: {response.text}")

        except Exception as e:
            print(f"   ✗ 获取知识库列表失败: {e}")

        try:
            # 3. 检查配置的知识库
            print(f"\n3. 检查配置的知识库 ID: {KNOWLEDGEBASE_ID}")
            response = await client.get(
                f"{BASE_URL}/api/v1/knowledgebases/{KNOWLEDGEBASE_ID}",
                headers=headers
            )
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                kb_info = response.json()
                print(f"   ✓ 知识库存在:")
                print(f"     Name: {kb_info.get('name')}")
                print(f"     Description: {kb_info.get('description')}")
                print(f"     Full response: {kb_info}")
            else:
                print(f"   ✗ 知识库不存在或无法访问")
                print(f"   Response: {response.text}")
                print(f"\n   解决方案:")
                print(f"   1. 确认知识库 ID 是否正确")
                print(f"   2. 在 RAGFlow 中创建新的知识库")
                print(f"   3. 更新环境变量 ARTICLE_STUDIO_RAGFLOW_KNOWLEDGEBASE_ID")

        except Exception as e:
            print(f"   ✗ 检查知识库失败: {e}")

        try:
            # 4. 尝试创建测试知识库
            print(f"\n4. 尝试创建测试知识库...")
            test_kb_name = "测试知识库_自动创建"
            test_kb_data = {
                "name": test_kb_name,
                "description": "用于测试的自动创建知识库"
            }

            response = await client.post(
                f"{BASE_URL}/api/v1/knowledgebases",
                headers=headers,
                json=test_kb_data
            )
            print(f"   Status: {response.status_code}")

            if response.status_code in [200, 201]:
                result = response.json()
                print(f"   ✓ 知识库创建成功:")
                print(f"     ID: {result.get('id', result.get('knowledgebase_id'))}")
                print(f"     Name: {result.get('name')}")
                print(f"\n   请更新环境变量:")
                print(f"   export ARTICLE_STUDIO_RAGFLOW_KNOWLEDGEBASE_ID={result.get('id', result.get('knowledgebase_id'))}")
            else:
                print(f"   ✗ 知识库创建失败")
                print(f"   Response: {response.text}")

        except Exception as e:
            print(f"   ✗ 创建知识库失败: {e}")


if __name__ == "__main__":
    asyncio.run(test_connection())
