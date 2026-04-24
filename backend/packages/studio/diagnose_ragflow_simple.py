"""
简化的 RAGFlow 诊断脚本 - 只使用标准库
"""
import urllib.request
import urllib.error
import json
import os

# 配置
BASE_URL = os.getenv("ARTICLE_STUDIO_RAGFLOW_BASE_URL", "http://192.168.102.247:9222")
API_KEY = os.getenv("ARTICLE_STUDIO_RAGFLOW_API_KEY", "ragflow-GC48uXGSDLkEO_ENhtxtWUqZ5zKcLlbm_6XghbZCGCo")

def test_url(path):
    """测试单个 URL"""
    url = f"{BASE_URL}{path}"
    print(f"Testing: {url}")

    try:
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {API_KEY}")

        with urllib.request.urlopen(req, timeout=5) as response:
            status = response.status
            content_type = response.headers.get("Content-Type", "unknown")

            print(f"  Status: {status}")
            print(f"  Content-Type: {content_type}")

            content = response.read().decode("utf-8")

            if "application/json" in content_type:
                try:
                    data = json.loads(content)
                    print(f"  JSON Data: {json.dumps(data, indent=2)[:300]}...")
                except:
                    print(f"  Content: {content[:200]}...")
            else:
                print(f"  Content: {content[:200]}...")

            return True, status

    except urllib.error.HTTPError as e:
        print(f"  HTTP Error: {e.code} - {e.reason}")
        return False, e.code
    except urllib.error.URLError as e:
        print(f"  URL Error: {e.reason}")
        return False, str(e)
    except Exception as e:
        print(f"  Error: {e}")
        return False, str(e)

def main():
    print("=" * 60)
    print("RAGFlow 服务诊断")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"API Key: {API_KEY[:20]}...")
    print()

    # 测试路径
    paths_to_test = [
        "/",
        "/api/v1/knowledgebases",
        "/api/v1/datasets",
        "/api/knowledgebases",
        "/v1/knowledgebases",
        "/knowledgebases",
        "/openapi.json",
        "/docs",
    ]

    results = []
    for path in paths_to_test:
        success, status = test_url(path)
        results.append((path, success, status))
        print()

    print("=" * 60)
    print("总结")
    print("=" * 60)

    successful = [p for p, s, _ in results if s]
    if successful:
        print(f"✓ 找到 {len(successful)} 个可用的端点:")
        for path in successful:
            print(f"  - {path}")

        # 找到最相关的端点
        kb_paths = [p for p in successful if "knowledgebase" in p.lower()]
        if kb_paths:
            print(f"\n推荐使用知识库端点: {kb_paths[0]}")
    else:
        print("✗ 未找到任何可用的端点")
        print("\n请检查:")
        print("1. RAGFlow 服务是否正常运行")
        print("2. 服务地址是否正确")
        print("3. API Key 是否有效")

if __name__ == "__main__":
    main()
