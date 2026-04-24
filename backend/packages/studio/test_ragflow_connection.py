"""
测试 RAGFlow API 连接和知识库状态
"""
import asyncio
import os
import sys

# 添加项目路径
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.insert(0, backend_dir)

from packages.studio.integrations.ragflow_client import RagflowClient
from packages.studio.settings.ragflow_settings import RagflowSettings


async def test_ragflow_connection():
    """测试 RAGFlow API 连接"""
    print("=" * 60)
    print("RAGFlow API 连接测试")
    print("=" * 60)

    settings = RagflowSettings()
    client = RagflowClient()

    print(f"\n配置信息:")
    print(f"  Base URL: {settings.base_url}")
    print(f"  API Key: {settings.api_key[:20]}...")
    print(f"  Knowledgebase ID: {settings.knowledgebase_id}")

    try:
        # 1. 列出所有知识库
        print(f"\n1. 列出所有知识库...")
        kbs = await client.list_knowledgebases()
        print(f"   找到 {len(kbs)} 个知识库:")
        for kb in kbs:
            kb_id = kb.get('id', kb.get('knowledgebase_id', 'N/A'))
            kb_name = kb.get('name', 'N/A')
            print(f"   - ID: {kb_id}, Name: {kb_name}")

        # 2. 检查配置的知识库是否存在
        print(f"\n2. 检查配置的知识库 ID: {settings.knowledgebase_id}")
        try:
            kb_info = await client.get_knowledgebase(settings.knowledgebase_id)
            print(f"   ✓ 知识库存在:")
            print(f"     Name: {kb_info.get('name')}")
            print(f"     Description: {kb_info.get('description')}")
        except Exception as e:
            print(f"   ✗ 知识库不存在或无法访问: {e}")
            print(f"\n   建议: 请检查以下选项:")
            print(f"   1. 确认知识库 ID 是否正确")
            print(f"   2. 在 RAGFlow 中创建新的知识库")
            print(f"   3. 更新环境变量 ARTICLE_STUDIO_RAGFLOW_KNOWLEDGEBASE_ID")

        # 3. 尝试创建测试知识库（可选）
        print(f"\n3. 是否需要创建新的知识库? (y/n)")
        # 这里只是提示，实际创建需要用户确认

    except Exception as e:
        print(f"\n✗ API 连接失败: {e}")
        print(f"\n请检查:")
        print(f"  1. RAGFlow 服务是否运行在 {settings.base_url}")
        print(f"  2. API Key 是否正确")
        print(f"  3. 网络连接是否正常")


async def test_document_upload():
    """测试文档上传"""
    print("\n" + "=" * 60)
    print("文档上传测试")
    print("=" * 60)

    settings = RagflowSettings()
    client = RagflowClient()

    try:
        # 先检查知识库是否存在
        print(f"\n检查知识库: {settings.knowledgebase_id}")
        await client.get_knowledgebase(settings.knowledgebase_id)
        print("✓ 知识库存在")

        # 尝试上传测试文档
        print(f"\n尝试上传测试文档...")
        result = await client.upload_document(
            knowledgebase_id=settings.knowledgebase_id,
            document_name="测试文档",
            content="这是一个测试文档的内容。",
        )
        print(f"✓ 文档上传成功:")
        print(f"  Result: {result}")

    except Exception as e:
        print(f"✗ 文档上传失败: {e}")


if __name__ == "__main__":
    asyncio.run(test_ragflow_connection())
    # 如果需要测试文档上传，取消下面的注释
    # asyncio.run(test_document_upload())
