/**
 * 文章发布服务
 * 基于 wechatsync/article-syncjs 实现多平台文章同步发布
 */

export interface PublishAccount {
  id: string;
  type: PlatformType;
  name: string;
  avatar?: string;
  config: Record<string, any>;
}

export type PlatformType =
  | "zhihu"
  | "toutiao"
  | "juejin"
  | "csdn"
  | "weixin"
  | "bilibili"
  | "segmentfault"
  | "jianshu"
  | "weibo"
  | "cnblog"
  | "douban"
  | "baijiahao"
  | "sohu"
  | "oschina"
  | "wordpress";

export const PLATFORMS: PlatformType[] = [
  "zhihu",
  "toutiao",
  "juejin",
  "csdn",
  "weixin",
  "bilibili",
  "segmentfault",
  "jianshu",
  "weibo",
  "cnblog",
  "douban",
  "baijiahao",
  "sohu",
  "oschina",
  "wordpress",
];

export interface PublishPost {
  title: string;
  content: string; // Markdown 内容
  desc?: string; // 摘要
  thumb?: string; // 封面图
  tags?: string[];
}

export interface PublishResult {
  success: boolean;
  platform: PlatformType;
  postId?: string;
  draftUrl?: string;
  error?: string;
}

export interface PublishProgress {
  platform: PlatformType;
  status: "pending" | "uploading" | "publishing" | "success" | "error";
  progress?: number;
  message?: string;
}

/**
 * 发布服务类
 * 负责协调多平台文章发布
 */
export class PublishService {
  private accounts: PublishAccount[] = [];

  constructor(accounts?: PublishAccount[]) {
    if (accounts) {
      this.accounts = accounts;
    }
  }

  /**
   * 添加发布账号
   */
  addAccount(account: PublishAccount) {
    this.accounts.push(account);
  }

  /**
   * 移除发布账号
   */
  removeAccount(accountId: string) {
    this.accounts = this.accounts.filter((a) => a.id !== accountId);
  }

  /**
   * 获取所有账号
   */
  getAccounts(): PublishAccount[] {
    return this.accounts;
  }

  /**
   * 发布文章到指定平台
   */
  async publishToPlatform(
    post: PublishPost,
    account: PublishAccount,
    onProgress?: (progress: PublishProgress) => void
  ): Promise<PublishResult> {
    try {
      onProgress?.({
        platform: account.type,
        status: "pending",
        message: "准备发布...",
      });

      // 这里需要集成 article-syncjs 库
      // 由于该库依赖浏览器环境，我们需要通过 API 调用的方式实现
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post,
          account,
        }),
      });

      if (!response.ok) {
        throw new Error(`发布失败: ${response.statusText}`);
      }

      const result = await response.json();

      onProgress?.({
        platform: account.type,
        status: "success",
        message: "发布成功",
      });

      return {
        success: true,
        platform: account.type,
        postId: result.postId,
        draftUrl: result.draftUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "未知错误";

      onProgress?.({
        platform: account.type,
        status: "error",
        message: errorMessage,
      });

      return {
        success: false,
        platform: account.type,
        error: errorMessage,
      };
    }
  }

  /**
   * 批量发布文章到多个平台
   */
  async publishToMultiplePlatforms(
    post: PublishPost,
    accountIds?: string[],
    onProgress?: (progress: PublishProgress) => void
  ): Promise<PublishResult[]> {
    const targetAccounts = accountIds
      ? this.accounts.filter((a) => accountIds.includes(a.id))
      : this.accounts;

    const results: PublishResult[] = [];

    for (const account of targetAccounts) {
      const result = await this.publishToPlatform(post, account, onProgress);
      results.push(result);
    }

    return results;
  }
}

/**
 * 获取平台显示名称
 */
export function getPlatformName(platform: PlatformType): string {
  const names: Record<PlatformType, string> = {
    zhihu: "知乎",
    toutiao: "今日头条",
    juejin: "掘金",
    csdn: "CSDN",
    weixin: "微信公众号",
    bilibili: "哔哩哔哩",
    segmentfault: "SegmentFault",
    jianshu: "简书",
    weibo: "微博",
    cnblog: "博客园",
    douban: "豆瓣",
    baijiahao: "百家号",
    sohu: "搜狐",
    oschina: "开源中国",
    wordpress: "WordPress",
  };

  return names[platform] || platform;
}

/**
 * 获取平台图标
 */
export function getPlatformIcon(platform: PlatformType): string {
  const icons: Record<PlatformType, string> = {
    zhihu: "📘",
    toutiao: "📰",
    juejin: "💎",
    csdn: "💻",
    weixin: "💬",
    bilibili: "📺",
    segmentfault: "🔧",
    jianshu: "✍️",
    weibo: "📢",
    cnblog: "📝",
    douban: "🎬",
    baijiahao: "📱",
    sohu: "🦊",
    oschina: "🍊",
    wordpress: "🌐",
  };

  return icons[platform] || "📄";
}
