import { NextRequest, NextResponse } from "next/server";

/**
 * 文章发布 API
 * 接收前端发布请求，调用 article-syncjs 进行多平台发布
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post, account } = body;

    // 验证必要参数
    if (!post || !account) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    if (!post.title || !post.content) {
      return NextResponse.json(
        { error: "文章标题和内容不能为空" },
        { status: 400 }
      );
    }

    // TODO: 集成 article-syncjs 库进行实际发布
    // 由于 article-syncjs 依赖浏览器环境，这里需要：
    // 1. 使用 puppeteer 或类似工具模拟浏览器环境
    // 2. 或者通过 WebSocket 与浏览器扩展通信
    // 3. 或者使用各平台的官方 API

    // 模拟发布过程
    console.log(`[Publish API] 发布文章到 ${account.type}:`, {
      title: post.title,
      contentLength: post.content.length,
      accountName: account.name,
    });

    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 返回模拟结果
    return NextResponse.json({
      success: true,
      postId: `mock-post-${Date.now()}`,
      draftUrl: `https://${account.type}.com/draft/${Date.now()}`,
    });
  } catch (error) {
    console.error("[Publish API] 发布失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发布失败" },
      { status: 500 }
    );
  }
}
