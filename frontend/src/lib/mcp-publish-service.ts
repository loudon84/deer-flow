/**
 * MCP 发布服务
 * 通过 MCP Server 调用 WechatSync 进行文章发布
 */

import type { PlatformType } from "./publish-service";
import { getMCPConfig, type MCPConfig } from "@/components/publish/mcp-config";

export interface MCPPublishPost {
  title: string;
  content: string;
  desc?: string;
  thumb?: string;
  tags?: string[];
}

export interface MCPPublishResult {
  success: boolean;
  platform: PlatformType;
  postId?: string;
  draftUrl?: string;
  editUrl?: string;
  error?: string;
}

export interface MCPAccount {
  platform: PlatformType;
  uid: string;
  name: string;
  avatar?: string;
  home?: string;
}

/**
 * MCP API 调用
 */
async function mcpFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  config?: MCPConfig
): Promise<T> {
  const mcpConfig = config || getMCPConfig();

  if (!mcpConfig || !mcpConfig.enabled) {
    throw new Error("MCP 连接未配置或未启用");
  }

  const serverUrl = mcpConfig.serverUrl.trim();

  // 判断协议类型
  const isWebSocket = serverUrl.startsWith('ws://') || serverUrl.startsWith('wss://');

  if (isWebSocket) {
    // WebSocket 调用
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(serverUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('连接超时'));
      }, 30000);

      ws.onopen = () => {
        // 发送认证
        ws.send(JSON.stringify({
          type: 'auth',
          token: mcpConfig.token
        }));

        // 发送请求
        ws.send(JSON.stringify({
          type: 'request',
          endpoint,
          method: options.method || 'GET',
          body: options.body ? JSON.parse(options.body as string) : undefined
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'response') {
            clearTimeout(timeout);
            ws.close();
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.data);
            }
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(data.message));
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket 连接失败'));
      };
    });
  } else {
    // HTTP 调用
    const response = await fetch(`${serverUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mcpConfig.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MCP API 错误: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

/**
 * 获取所有已登录账号
 */
export async function getMCPAccounts(): Promise<MCPAccount[]> {
  try {
    const accounts = await mcpFetch<MCPAccount[]>("/api/accounts");
    return accounts || [];
  } catch (error) {
    console.error("[MCP] 获取账号失败:", error);
    return [];
  }
}

/**
 * 检测平台登录态
 */
export async function checkMCPPlatformLogin(
  platform: PlatformType
): Promise<MCPAccount | null> {
  try {
    const account = await mcpFetch<MCPAccount | null>(
      `/api/accounts/${platform}`
    );
    return account;
  } catch (error) {
    console.error(`[MCP] 检测 ${platform} 登录态失败:`, error);
    return null;
  }
}

/**
 * 发布文章到指定平台
 */
export async function mcpPublishToPlatform(
  platform: PlatformType,
  post: MCPPublishPost,
  onProgress?: (status: string, message: string) => void
): Promise<MCPPublishResult> {
  try {
    onProgress?.("preparing", "准备发布...");

    const config = getMCPConfig();
    if (!config || !config.enabled) {
      throw new Error("MCP 连接未配置或未启用");
    }

    const serverUrl = config.serverUrl.trim();
    const isWebSocket = serverUrl.startsWith('ws://') || serverUrl.startsWith('wss://');

    if (isWebSocket) {
      // WebSocket 发布
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(serverUrl);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('发布超时'));
        }, 120000); // 2分钟超时

        ws.onopen = () => {
          // 发送认证
          ws.send(JSON.stringify({
            type: 'auth',
            token: config.token
          }));

          // 发送发布请求
          ws.send(JSON.stringify({
            type: 'publish',
            platform,
            post
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'progress') {
              onProgress?.(data.status, data.message);
            } else if (data.type === 'result') {
              clearTimeout(timeout);
              ws.close();
              resolve(data.result);
            } else if (data.type === 'error') {
              clearTimeout(timeout);
              ws.close();
              resolve({
                success: false,
                platform,
                error: data.message
              });
            }
          } catch (error) {
            console.error('解析消息失败:', error);
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket 连接失败'));
        };
      });
    } else {
      // HTTP 发布（SSE）
      const response = await fetch(`${serverUrl}/api/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          platform,
          post,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`发布失败: ${error}`);
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("无法读取响应流");
      }

      let result: MCPPublishResult | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                onProgress?.(data.status, data.message);
              } else if (data.type === "result") {
                result = data.result;
              }
            } catch (error) {
              console.error("解析 SSE 数据失败:", error);
            }
          }
        }
      }

      if (!result) {
        throw new Error("未收到发布结果");
      }

      return result;
    }
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
export async function mcpPublishToMultiplePlatforms(
  platforms: PlatformType[],
  post: MCPPublishPost,
  onProgress?: (
    platform: PlatformType,
    status: string,
    message: string
  ) => void
): Promise<MCPPublishResult[]> {
  const results: MCPPublishResult[] = [];

  for (const platform of platforms) {
    const result = await mcpPublishToPlatform(platform, post, (status, message) => {
      onProgress?.(platform, status, message);
    });
    results.push(result);
  }

  return results;
}

/**
 * 上传图片
 */
export async function mcpUploadImage(
  platform: PlatformType,
  file: File | string
): Promise<{ url: string; id?: string }> {
  try {
    const result = await mcpFetch<{ url: string; id?: string }>(
      "/api/upload-image",
      {
        method: "POST",
        body: JSON.stringify({ platform, file }),
      }
    );
    return result;
  } catch (error) {
    throw new Error(
      `上传图片失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}
