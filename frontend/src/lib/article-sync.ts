/**
 * Article Sync JS 库集成
 * 官方库：https://github.com/wechatsync/article-syncjs
 */

import type { PlatformType } from "./publish-service";

// 声明全局函数
declare global {
  interface Window {
    syncPost?: (post: ArticleSyncPost) => Promise<ArticleSyncResult>;
    syncInit?: (config?: any) => Promise<void>;
  }
}

export interface ArticleSyncPost {
  title: string;
  content: string; // Markdown 或 HTML
  desc?: string; // 摘要
  thumb?: string; // 封面图
  tags?: string[];
}

export interface ArticleSyncResult {
  success: boolean;
  platform?: string;
  url?: string; // 草稿链接
  error?: string;
}

/**
 * 加载 article-syncjs 库
 */
export async function loadArticleSyncJS(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  // 已经加载
  if (window.syncPost) {
    console.log("[ArticleSync] 库已加载");
    return true;
  }

  try {
    // 动态加载脚本
    await new Promise<void>((resolve, reject) => {
      // 加载 CSS
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href =
        "https://cdn.jsdelivr.net/gh/wechatsync/article-syncjs@latest/dist/styles.css";
      document.head.appendChild(css);

      // 加载 JS
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/gh/wechatsync/article-syncjs@latest/dist/main.js";
      script.onload = () => {
        console.log("[ArticleSync] 库加载成功");
        resolve();
      };
      script.onerror = () => {
        reject(new Error("加载 article-syncjs 失败"));
      };
      document.head.appendChild(script);
    });

    // 验证是否加载成功
    if (!window.syncPost) {
      throw new Error("syncPost 函数未定义");
    }

    return true;
  } catch (error) {
    console.error("[ArticleSync] 加载失败:", error);
    return false;
  }
}

/**
 * 检查 article-syncjs 是否已加载
 */
export function isArticleSyncLoaded(): boolean {
  return typeof window !== "undefined" && !!window.syncPost;
}

/**
 * 使用 article-syncjs 发布文章
 */
export async function publishWithArticleSync(
  post: ArticleSyncPost
): Promise<ArticleSyncResult> {
  try {
    // 确保库已加载
    if (!isArticleSyncLoaded()) {
      const loaded = await loadArticleSyncJS();
      if (!loaded) {
        throw new Error("无法加载 article-syncjs 库");
      }
    }

    // 调用发布函数
    console.log("[ArticleSync] 开始发布:", post.title);
    const result = await window.syncPost!(post);

    console.log("[ArticleSync] 发布结果:", result);
    return result;
  } catch (error) {
    console.error("[ArticleSync] 发布失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "发布失败",
    };
  }
}

/**
 * 批量发布到多个平台
 * 注意：article-syncjs 会自动检测已登录的平台并发布
 */
export async function publishToMultipleWithArticleSync(
  post: ArticleSyncPost,
  onProgress?: (message: string) => void
): Promise<ArticleSyncResult[]> {
  try {
    onProgress?.("正在加载 article-syncjs 库...");

    // 加载库
    if (!isArticleSyncLoaded()) {
      const loaded = await loadArticleSyncJS();
      if (!loaded) {
        throw new Error("无法加载 article-syncjs 库");
      }
    }

    onProgress?.("开始发布文章...");

    // article-syncjs 会自动发布到所有已登录的平台
    const result = await publishWithArticleSync(post);

    // 返回结果（article-syncjs 可能返回多个平台的结果）
    if (result.success) {
      return [result];
    } else {
      return [result];
    }
  } catch (error) {
    return [
      {
        success: false,
        error: error instanceof Error ? error.message : "发布失败",
      },
    ];
  }
}
