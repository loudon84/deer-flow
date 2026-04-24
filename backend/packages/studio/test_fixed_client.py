"""
测试修复后的 RAGFlow 客户端
"""
import asyncio
import sys
import os

# 添加项目路径
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.insert(0, backend_dir)

from packages.studio.integrations.ragflow_client import RagflowClient


async def test_fixed_client():
    """测试修复后的客户端"""
    print("=" * 60)
    print("测试修复后的 RAGFlow 客户端")
    print("=" * 60)

    client = RagflowClient()

    try:
        # 1. 列出所有 datasets
        print("\n1. 列出所有 datasets...")
        datasets = await client.list_knowledgebases()
        print(f"   找到 {len(datasets)} 个 datasets:")
        for ds in datasets[:3]:  # 只显示前3个
            ds_id = ds.get('id', 'N/A')
            ds_name = ds.get('name', 'N/A')
            print(f"   - ID: {ds_id}, Name: {ds_name}")

        # 2. 获取配置的 dataset
        print(f"\n2. 获取配置的 dataset: {client.settings.knowledgebase_id}")
        try:
            kb_info = await client.get_knowledgebase(client.settings.knowledgebase_id)
            print(f"   Dataset 存在:")
            print(f"     Name: {kb_info.get('name')}")
            print(f"     Description: {kb_info.get('description')}")
        except Exception as e:
            print(f"   Dataset 获取失败: {e}")

        # 3. 测试文档上传
        print(f"\n3. 测试文档上传...")
        try:
            result = await client.upload_document(
                knowledgebase_id=client.settings.knowledgebase_id,
                document_name="Test Document from Python Client",
                content="This is a test document uploaded via Python client."
            )
            print(f"   文档上传成功:")
            print(f"     Result: {result}")
        except Exception as e:
            print(f"   文档上传失败: {e}")

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_fixed_client())
