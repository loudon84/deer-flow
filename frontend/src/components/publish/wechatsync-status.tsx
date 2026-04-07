"use client";

import { useState, useEffect } from "react";
import { CheckCircle2Icon, XCircleIcon, Loader2Icon, RefreshCwIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  detectWechatSyncPlugin,
  getLoggedInAccounts,
  type WechatSyncAccount,
} from "@/lib/wechatsync-bridge";
import { getPlatformName, getPlatformIcon } from "@/lib/publish-service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WechatSyncStatusProps {
  onAccountsLoaded?: (accounts: WechatSyncAccount[]) => void;
  className?: string;
}

export function WechatSyncStatus({
  onAccountsLoaded,
  className,
}: WechatSyncStatusProps) {
  const [pluginInstalled, setPluginInstalled] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<WechatSyncAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [extensionId, setExtensionId] = useState("");

  // 加载已保存的扩展 ID
  useEffect(() => {
    const savedId = localStorage.getItem("wechatsync_extension_id");
    if (savedId) {
      setExtensionId(savedId);
    }
  }, []);

  // 检测插件
  const checkPlugin = async () => {
    setLoading(true);
    try {
      const installed = await detectWechatSyncPlugin();
      setPluginInstalled(installed);

      if (installed) {
        const loggedInAccounts = await getLoggedInAccounts();
        setAccounts(loggedInAccounts);
        onAccountsLoaded?.(loggedInAccounts);
      } else {
        setAccounts([]);
        onAccountsLoaded?.([]);
      }
    } catch (error) {
      console.error("检测插件失败:", error);
      setPluginInstalled(false);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPlugin();
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 插件状态 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">WechatSync 插件状态</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkPlugin}
          disabled={loading}
        >
          {loading ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 状态卡片 */}
      <div
        className={cn(
          "rounded-lg border p-4",
          pluginInstalled === true && "border-green-500 bg-green-50",
          pluginInstalled === false && "border-red-500 bg-red-50",
          pluginInstalled === null && "border-gray-300 bg-gray-50"
        )}
      >
        <div className="flex items-center gap-3">
          {pluginInstalled === null && (
            <>
              <Loader2Icon className="h-5 w-5 animate-spin text-gray-500" />
              <div>
                <div className="font-medium">检测中...</div>
                <div className="text-muted-foreground text-sm">
                  正在检测 WechatSync 浏览器插件
                </div>
              </div>
            </>
          )}

          {pluginInstalled === true && (
            <>
              <CheckCircle2Icon className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">插件已安装</div>
                <div className="text-green-700 text-sm">
                  已检测到 {accounts.length} 个已登录账号
                </div>
              </div>
            </>
          )}

          {pluginInstalled === false && (
            <>
              <XCircleIcon className="h-5 w-5 text-red-600" />
              <div>
                <div className="font-medium text-red-900">插件未检测到</div>
                <div className="text-red-700 text-sm">
                  请使用 MCP 方式或手动配置账号
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  toast.info("请配置 MCP Server 或手动添加账号");
                }}
              >
                查看帮助
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 已登录账号列表 */}
      {pluginInstalled === true && accounts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">已登录账号</h4>
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={`${account.platform}-${account.uid}`}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <span className="text-lg">
                  {getPlatformIcon(account.platform)}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{account.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {getPlatformName(account.platform)} · {account.uid}
                  </div>
                </div>
                {account.home && (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={account.home}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      查看
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 使用说明 */}
      {pluginInstalled === true && accounts.length === 0 && (
        <div className="text-muted-foreground text-center text-sm">
          暂无已登录账号，请先登录各平台
        </div>
      )}
    </div>
  );
}
