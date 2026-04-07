"use client";

import { useState, useEffect, useContext } from "react";
import { CheckCircle2Icon, CircleIcon, Loader2Icon, XCircleIcon, SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/core/i18n/hooks";
import {
  PublishService,
  type PublishAccount,
  type PublishPost,
  type PublishProgress,
  type PlatformType,
  getPlatformName,
  getPlatformIcon,
} from "@/lib/publish-service";
import { getPublishAccounts } from "@/lib/publish-accounts-store";
import { cn } from "@/lib/utils";
import { SettingsContext } from "@/components/workspace/settings/settings-context";
import {
  detectWechatSyncPlugin,
  publishToPlatform as realPublishToPlatform,
  type WechatSyncPost,
} from "@/lib/wechatsync-bridge";
import {
  mcpPublishToPlatform,
  type MCPPublishPost,
} from "@/lib/mcp-publish-service";
import {
  publishWithArticleSync,
  isArticleSyncLoaded,
  loadArticleSyncJS,
  type ArticleSyncPost,
} from "@/lib/article-sync";
import { getMCPConfig } from "./mcp-config";
import { toast } from "sonner";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markdown: string;
  title?: string;
}

export function PublishDialog({
  open,
  onOpenChange,
  markdown,
  title,
}: PublishDialogProps) {
  const { t } = useI18n();
  const settingsContext = useContext(SettingsContext);
  const [accounts, setAccounts] = useState<PublishAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState<Map<string, PublishProgress>>(
    new Map()
  );
  const [results, setResults] = useState<
    Array<{ platform: PlatformType; success: boolean; draftUrl?: string }>
  >([]);

  // 加载账号列表
  useEffect(() => {
    if (open) {
      setAccounts(getPublishAccounts());
    }
  }, [open]);

  // 打开设置对话框
  const handleOpenSettings = () => {
    onOpenChange(false);
    settingsContext?.openSettings?.("publish");
  };

  const handleToggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handlePublish = async () => {
    if (selectedAccounts.length === 0) {
      return;
    }

    setPublishing(true);
    setResults([]);
    setProgress(new Map());

    const post = {
      title: title || "未命名文章",
      content: markdown,
    };

    // 方式1: 使用 Article Sync JS（推荐）
    if (isArticleSyncLoaded() || (await loadArticleSyncJS())) {
      try {
        const result = await publishWithArticleSync(post);

        if (result.success) {
          toast.success("发布成功");
          if (result.url) {
            toast.info(`草稿链接: ${result.url}`);
          }
        } else {
          toast.error(result.error || "发布失败");
        }

        setResults([
          {
            platform: "zhihu" as any, // Article Sync 会自动选择平台
            success: result.success,
            draftUrl: result.url,
          },
        ]);
      } catch (error) {
        toast.error("Article Sync 发布失败");
      }

      setPublishing(false);
      return;
    }

    // 方式2: 检查 MCP 配置
    const mcpConfig = getMCPConfig();
    const useMCP = mcpConfig && mcpConfig.enabled;

    if (useMCP) {
      // 使用 MCP 发布
      const mcpPost: MCPPublishPost = post;

      for (const accountId of selectedAccounts) {
        const account = accounts.find((a) => a.id === accountId);
        if (!account) continue;

        try {
          const result = await mcpPublishToPlatform(
            account.type,
            mcpPost,
            (status, message) => {
              setProgress((prev) => {
                const next = new Map(prev);
                next.set(account.type, {
                  platform: account.type,
                  status: status as any,
                  message,
                });
                return next;
              });
            }
          );

          setResults((prev) => [
            ...prev,
            {
              platform: account.type,
              success: result.success,
              draftUrl: result.draftUrl,
            },
          ]);
        } catch (error) {
          setResults((prev) => [
            ...prev,
            {
              platform: account.type,
              success: false,
            },
          ]);
        }
      }
    } else {
      // 方式3: 使用浏览器插件发布
      const pluginInstalled = await detectWechatSyncPlugin();

      if (!pluginInstalled) {
        toast.error("请先配置发布方式：Article Sync、MCP 或浏览器插件");
        setPublishing(false);
        return;
      }

      const wsPost: WechatSyncPost = post;

      for (const accountId of selectedAccounts) {
        const account = accounts.find((a) => a.id === accountId);
        if (!account) continue;

        try {
          const result = await realPublishToPlatform(
            account.type,
            wsPost,
            (status, message) => {
              setProgress((prev) => {
                const next = new Map(prev);
                next.set(account.type, {
                  platform: account.type,
                  status: status as any,
                  message,
                });
                return next;
              });
            }
          );

          setResults((prev) => [
            ...prev,
            {
              platform: account.type,
              success: result.success,
              draftUrl: result.draftUrl,
            },
          ]);
        } catch (error) {
          setResults((prev) => [
            ...prev,
            {
              platform: account.type,
              success: false,
            },
          ]);
        }
      }
    }

    setPublishing(false);
  };

  const handleClose = () => {
    if (!publishing) {
      onOpenChange(false);
      setSelectedAccounts([]);
      setProgress(new Map());
      setResults([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t.common.publish}</DialogTitle>
          <DialogDescription>
            选择要发布到的平台，文章将以 Markdown 格式同步发布
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {accounts.length === 0 ? (
            <div className="space-y-3 text-center">
              <div className="text-muted-foreground text-sm">
                暂无可用账号，请先添加发布账号
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenSettings}
              >
                <SettingsIcon className="mr-2 h-4 w-4" />
                前往设置
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => {
                const prog = progress.get(account.type);
                const isSelected = selectedAccounts.includes(account.id);

                return (
                  <div
                    key={account.id}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border p-3",
                      isSelected && "border-primary bg-primary/5",
                      prog?.status === "success" && "border-green-500",
                      prog?.status === "error" && "border-red-500"
                    )}
                  >
                    <Checkbox
                      id={account.id}
                      checked={isSelected}
                      onCheckedChange={() => handleToggleAccount(account.id)}
                      disabled={publishing}
                    />
                    <label
                      htmlFor={account.id}
                      className="flex flex-1 items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <span className="text-lg">
                        {getPlatformIcon(account.type)}
                      </span>
                      <span>{account.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({getPlatformName(account.type)})
                      </span>
                    </label>

                    {prog && (
                      <div className="flex items-center gap-2">
                        {prog.status === "pending" && (
                          <CircleIcon className="text-muted-foreground h-4 w-4" />
                        )}
                        {prog.status === "uploading" && (
                          <Loader2Icon className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        {prog.status === "publishing" && (
                          <Loader2Icon className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        {prog.status === "success" && (
                          <CheckCircle2Icon className="h-4 w-4 text-green-500" />
                        )}
                        {prog.status === "error" && (
                          <XCircleIcon className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-muted-foreground text-xs">
                          {prog.message}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={publishing}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={selectedAccounts.length === 0 || publishing}
          >
            {publishing ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                发布中...
              </>
            ) : (
              t.common.publish
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
