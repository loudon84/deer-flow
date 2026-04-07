/**
 * WechatSync 浏览器插件桥接
 * 负责与 WechatSync Chrome 扩展通信
 */

import type { PlatformType } from "./publish-service";

// Chrome API 类型声明
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (
          extensionId: string,
          message: any,
          callback?: (response: any) => void
        ) => void;
        lastError?: { message: string };
      };
    };
    // WechatSync JSSDK
    $syncer?: {
      // 获取所有账号
      getAccounts?: () => Promise<WechatSyncAccount[]>;
      // 发布文章
      publish?: (platform: string, post: any) => Promise<any>;
      // 检测登录态
      checkLogin?: (platform: string) => Promise<boolean>;
      // 版本信息
      version?: string;
    };
    // WechatSync 另一个可能的 API
    $poster?: {
      post?: (platform: string, content: any) => Promise<any>;
    };
  }
}

// 消息类型定义
export interface WechatSyncMessage {
  type: string;
  data?: any;
}

export interface WechatSyncResponse {
  type: string;
  success: boolean;
  data?: any;
  error?: string;
}

// 账号信息
export interface WechatSyncAccount {
  platform: PlatformType;
  uid: string;
  name: string;
  avatar?: string;
  home?: string;
  supportTypes?: string[];
}

// 文章信息
export interface WechatSyncPost {
  title: string;
  content: string;
  desc?: string;
  thumb?: string;
  tags?: string[];
}

// 发布结果
export interface WechatSyncPublishResult {
  success: boolean;
  platform: PlatformType;
  postId?: string;
  draftUrl?: string;
  editUrl?: string;
  error?: string;
}

// 消息 ID 计数器
let messageId = 0;

/**
 * 生成唯一消息 ID
 */
function generateMessageId(): string {
  return `deerflow-${Date.now()}-${++messageId}`;
}

/**
 * 发送消息到 WechatSync 插件并等待响应
 */
function sendMessage<T = any>(
  type: string,
  data?: any,
  timeout = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = generateMessageId();
    const timeoutId = setTimeout(() => {
      reject(new Error(`消息超时: ${type}`));
    }, timeout);

    // 监听响应
    const handleMessage = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data?.type === `${type}_RESPONSE` &&
        event.data?.id === id
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handleMessage);

        if (event.data.success) {
          resolve(event.data.data);
        } else {
          reject(new Error(event.data.error || "操作失败"));
        }
      }
    };

    window.addEventListener("message", handleMessage);

    // 发送消息
    window.postMessage(
      {
        type,
        id,
        source: "deerflow",
        data,
      },
      "*"
    );
  });
}

/**
 * 检测 WechatSync 插件是否已安装
 * 通过多种方式检测：
 * 1. 检查全局变量 window.$syncer（JSSDK）
 * 2. 检查全局变量 window.$poster
 * 3. 检查 Chrome 扩展 ID
 * 4. 发送消息检测
 */
export async function detectWechatSyncPlugin(): Promise<boolean> {
  // 方式1: 检查 JSSDK 全局变量 $syncer（推荐）
  if (typeof window !== "undefined" && window.$syncer) {
    console.log("[WechatSync] 检测到 JSSDK $syncer", window.$syncer.version || '');
    return true;
  }

  // 方式2: 检查 $poster API
  if (typeof window !== "undefined" && window.$poster) {
    console.log("[WechatSync] 检测到 $poster API");
    return true;
  }

  // 方式3: 检查 Chrome 扩展（通过检查特定的 DOM 元素或资源）
  if (typeof window !== "undefined" && window.chrome?.runtime) {
    try {
      // WechatSync 的扩展 ID（需要用户提供）
      const extensionId = localStorage.getItem("wechatsync_extension_id");
      if (extensionId && window.chrome?.runtime?.sendMessage) {
        // 尝试发送消息到扩展
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("超时")), 1000);
          window.chrome!.runtime!.sendMessage!(
            extensionId,
            { type: "PING" },
            (response) => {
              clearTimeout(timeout);
              if (window.chrome?.runtime?.lastError) {
                reject(new Error(window.chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            }
          );
        });
        return true;
      }
    } catch (error) {
      console.warn("[WechatSync] Chrome 扩展检测失败:", error);
    }
  }

  // 方式4: 发送消息检测（需要插件支持）
  try {
    const response = await sendMessage<boolean>(
      "WECHATSYNC_DETECT",
      undefined,
      3000
    );
    return response === true;
  } catch (error) {
    console.warn("[WechatSync] 消息检测失败:", error);
  }

  return false;
}

/**
 * 获取所有已登录的账号
 */
export async function getLoggedInAccounts(): Promise<WechatSyncAccount[]> {
  try {
    // 方式1: 使用 JSSDK $syncer
    if (window.$syncer?.getAccounts) {
      console.log("[WechatSync] 使用 JSSDK $syncer.getAccounts()");
      try {
        const accounts = await window.$syncer.getAccounts();
        return accounts || [];
      } catch (error) {
        console.error("[WechatSync] $syncer.getAccounts() 失败:", error);
      }
    }

    // 方式2: 使用 $poster API（检查是否有账号相关方法）
    if (window.$poster) {
      console.log("[WechatSync] 检测到 $poster API");
      // $poster 可能没有获取账号的方法，跳过
    }

    // 方式3: 通过消息通信获取账号
    console.log("[WechatSync] 尝试通过消息通信获取账号");
    try {
      const accounts = await sendMessage<WechatSyncAccount[]>(
        "WECHATSYNC_GET_ACCOUNTS",
        undefined,
        5000
      );
      return accounts || [];
    } catch (error) {
      console.warn("[WechatSync] 消息通信获取账号失败:", error);
    }

    // 方式4: 返回空数组，提示用户手动配置
    console.warn("[WechatSync] 无法自动获取账号，请手动配置或使用 MCP");
    return [];
  } catch (error) {
    console.error("[WechatSync] 获取账号失败:", error);
    return [];
  }
}

/**
 * 检测指定平台的登录态
 */
export async function checkPlatformLogin(
  platform: PlatformType
): Promise<WechatSyncAccount | null> {
  try {
    const account = await sendMessage<WechatSyncAccount | null>(
      "WECHATSYNC_CHECK_LOGIN",
      { platform }
    );
    return account;
  } catch (error) {
    console.error(`[WechatSync] 检测 ${platform} 登录态失败:`, error);
    return null;
  }
}

/**
 * 发布文章到指定平台
 */
export async function publishToPlatform(
  platform: PlatformType,
  post: WechatSyncPost,
  onProgress?: (status: string, message: string) => void
): Promise<WechatSyncPublishResult> {
  try {
    onProgress?.("preparing", "准备发布...");

    // 方式1: 使用 JSSDK
    if (window.$syncer?.publish) {
      console.log("[WechatSync] 使用 JSSDK 发布");
      
      // 监听进度
      const handleProgress = (event: any) => {
        if (event.detail) {
          onProgress?.(event.detail.status, event.detail.message);
        }
      };

      // 添加进度监听器（如果支持）
      if (window.addEventListener) {
        window.addEventListener('wechatsync:progress', handleProgress as any);
      }

      try {
        const result = await window.$syncer.publish(platform, post);
        
        return {
          success: true,
          platform,
          postId: result.postId || result.post_id,
          draftUrl: result.draftUrl || result.draft_link,
          editUrl: result.editUrl || result.edit_link,
        };
      } finally {
        if (window.removeEventListener) {
          window.removeEventListener('wechatsync:progress', handleProgress as any);
        }
      }
    }

    // 方式2: 使用 $poster API
    if (window.$poster?.post) {
      console.log("[WechatSync] 使用 $poster API 发布");
      const result = await window.$poster.post(platform, post);
      
      return {
        success: true,
        platform,
        postId: result.postId || result.post_id,
        draftUrl: result.draftUrl || result.draft_link,
      };
    }

    // 方式3: 发送消息到插件
    // 监听进度消息
    const handleProgress = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data?.type === "WECHATSYNC_PUBLISH_PROGRESS"
      ) {
        const { status, message } = event.data;
        onProgress?.(status, message);
      }
    };

    window.addEventListener("message", handleProgress);

    // 发送发布请求
    const result = await sendMessage<WechatSyncPublishResult>(
      "WECHATSYNC_PUBLISH",
      {
        platform,
        post,
      },
      60000 // 60 秒超时
    );

    window.removeEventListener("message", handleProgress);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "发布失败";
    return {
      success: false,
      platform,
      error: errorMessage,
    };
  }
}

/**
 * 批量发布到多个平台
 */
export async function publishToMultiplePlatforms(
  platforms: PlatformType[],
  post: WechatSyncPost,
  onProgress?: (
    platform: PlatformType,
    status: string,
    message: string
  ) => void
): Promise<WechatSyncPublishResult[]> {
  const results: WechatSyncPublishResult[] = [];

  for (const platform of platforms) {
    const result = await publishToPlatform(platform, post, (status, message) => {
      onProgress?.(platform, status, message);
    });
    results.push(result);
  }

  return results;
}

/**
 * 获取平台支持的文章类型
 */
export async function getPlatformSupportTypes(
  platform: PlatformType
): Promise<string[]> {
  try {
    const types = await sendMessage<string[]>(
      "WECHATSYNC_GET_SUPPORT_TYPES",
      { platform }
    );
    return types || ["html", "markdown"];
  } catch (error) {
    console.error(`[WechatSync] 获取 ${platform} 支持类型失败:`, error);
    return ["html", "markdown"];
  }
}

/**
 * 上传图片到平台
 */
export async function uploadImage(
  platform: PlatformType,
  file: File | string // File 对象或 base64 字符串
): Promise<{ url: string; id?: string }> {
  try {
    const result = await sendMessage<{ url: string; id?: string }>(
      "WECHATSYNC_UPLOAD_IMAGE",
      {
        platform,
        file,
      }
    );
    return result;
  } catch (error) {
    throw new Error(
      `上传图片失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}
