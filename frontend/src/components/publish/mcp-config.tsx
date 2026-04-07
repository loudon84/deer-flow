"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  RefreshCwIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MCPConfigProps {
  className?: string;
  onConfigChange?: (config: MCPConfig) => void;
}

export interface MCPConfig {
  serverUrl: string;
  token: string;
  enabled: boolean;
}

const STORAGE_KEY = "wechatsync_mcp_config";

/**
 * 获取 MCP 配置
 */
export function getMCPConfig(): MCPConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as MCPConfig;
  } catch (error) {
    console.error("Failed to load MCP config:", error);
    return null;
  }
}

/**
 * 保存 MCP 配置
 */
export function saveMCPConfig(config: MCPConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save MCP config:", error);
  }
}

/**
 * 测试 MCP 连接
 */
export async function testMCPConnection(config: MCPConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const serverUrl = config.serverUrl.trim();

    // 判断协议类型
    const isWebSocket = serverUrl.startsWith('ws://') || serverUrl.startsWith('wss://');
    const isHttp = serverUrl.startsWith('http://') || serverUrl.startsWith('https://');

    if (!isWebSocket && !isHttp) {
      return {
        success: false,
        error: '无效的地址格式，请使用 ws://、wss://、http:// 或 https://'
      };
    }

    if (isWebSocket) {
      // WebSocket 连接测试
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket(serverUrl);

          const timeout = setTimeout(() => {
            ws.close();
            resolve({
              success: false,
              error: '连接超时，请检查服务是否启动'
            });
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeout);
            // 发送认证消息
            ws.send(JSON.stringify({
              type: 'auth',
              token: config.token
            }));
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'auth' && data.success) {
                ws.close();
                resolve({ success: true });
              } else if (data.type === 'error') {
                ws.close();
                resolve({
                  success: false,
                  error: data.message || '认证失败'
                });
              }
            } catch (error) {
              // 忽略解析错误
            }
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            resolve({
              success: false,
              error: 'WebSocket 连接失败，请检查地址和服务状态'
            });
          };

          ws.onclose = () => {
            clearTimeout(timeout);
          };
        } catch (error) {
          resolve({
            success: false,
            error: `WebSocket 创建失败: ${error instanceof Error ? error.message : '未知错误'}`
          });
        }
      });
    } else {
      // HTTP 连接测试
      const response = await fetch(`${serverUrl}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      });

      if (response.ok) {
        return { success: true };
      } else if (response.status === 401) {
        return {
          success: false,
          error: 'Token 无效或已过期'
        };
      } else if (response.status === 404) {
        return {
          success: false,
          error: '服务端点不存在，请检查服务是否正确启动'
        };
      } else {
        return {
          success: false,
          error: `连接失败: ${response.status} ${response.statusText}`
        };
      }
    }
  } catch (error) {
    console.error("MCP connection test failed:", error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: '网络请求失败，请检查地址是否正确或服务是否启动'
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '连接测试失败'
    };
  }
}

export function MCPConfigComponent({ className, onConfigChange }: MCPConfigProps) {
  const [config, setConfig] = useState<MCPConfig>({
    serverUrl: "",
    token: "",
    enabled: false,
  });
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);

  // 加载配置
  useEffect(() => {
    const savedConfig = getMCPConfig();
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, []);

  // 保存配置
  const handleSave = () => {
    if (!config.serverUrl.trim()) {
      toast.error("请输入 MCP Server 地址");
      return;
    }

    if (!config.token.trim()) {
      toast.error("请输入 MCP Token");
      return;
    }

    saveMCPConfig(config);
    onConfigChange?.(config);
    toast.success("配置已保存");
  };

  // 测试连接
  const handleTest = async () => {
    if (!config.serverUrl.trim() || !config.token.trim()) {
      toast.error("请先填写完整配置");
      return;
    }

    setTesting(true);
    setConnectionStatus(null);

    try {
      const result = await testMCPConnection(config);
      setConnectionStatus(result.success);

      if (result.success) {
        toast.success("连接成功");
      } else {
        toast.error(result.error || "连接失败");
      }
    } catch (error) {
      setConnectionStatus(false);
      toast.error(error instanceof Error ? error.message : "连接测试失败");
    } finally {
      setTesting(false);
    }
  };

  // 启用/禁用
  const handleToggle = () => {
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);
    saveMCPConfig(newConfig);
    onConfigChange?.(newConfig);

    if (!config.enabled) {
      toast.success("MCP 连接已启用");
    } else {
      toast.info("MCP 连接已禁用");
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">MCP Server 配置</h3>
        <div className="flex items-center gap-2">
          {connectionStatus !== null && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm",
                connectionStatus ? "text-green-600" : "text-red-600"
              )}
            >
              {connectionStatus ? (
                <>
                  <CheckCircle2Icon className="h-4 w-4" />
                  已连接
                </>
              ) : (
                <>
                  <XCircleIcon className="h-4 w-4" />
                  未连接
                </>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={testing || !config.serverUrl || !config.token}
          >
            {testing ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Server URL */}
        <div>
          <label className="text-sm font-medium">MCP Server 地址</label>
          <Input
            placeholder="ws://localhost:9527 或 http://localhost:3001"
            value={config.serverUrl}
            onChange={(e) =>
              setConfig({ ...config, serverUrl: e.target.value })
            }
            className="mt-1"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            支持 WebSocket (ws://) 或 HTTP (http://) 协议
          </p>
        </div>

        {/* Token */}
        <div>
          <label className="text-sm font-medium">MCP Token</label>
          <div className="relative mt-1">
            <Input
              type={showToken ? "text" : "password"}
              placeholder="输入 MCP Token"
              value={config.token}
              onChange={(e) => setConfig({ ...config, token: e.target.value })}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? (
                <EyeOffIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            用于认证的 Token，从 WechatSync MCP Server 获取
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={!config.serverUrl || !config.token}>
            保存配置
          </Button>
          <Button
            variant="outline"
            onClick={handleToggle}
            disabled={!config.serverUrl || !config.token}
          >
            {config.enabled ? "禁用" : "启用"}
          </Button>
        </div>

        {/* 使用说明 */}
        <div className="rounded-lg border bg-muted/50 p-3 text-sm">
          <div className="font-medium mb-2">使用说明：</div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>启动 WechatSync MCP Server</li>
            <li>从服务器获取 Token</li>
            <li>在上方填写配置并保存</li>
            <li>点击测试连接验证配置</li>
            <li>启用 MCP 连接</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
