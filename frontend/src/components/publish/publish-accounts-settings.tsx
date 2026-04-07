"use client";

import { useState, useEffect } from "react";
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/core/i18n/hooks";
import type { PublishAccount, PlatformType } from "@/lib/publish-service";
import {
  getPublishAccounts,
  addPublishAccount,
  updatePublishAccount,
  deletePublishAccount,
  isAccountNameExists,
  generateAccountId,
} from "@/lib/publish-accounts-store";
import { getPlatformName, getPlatformIcon, PLATFORMS } from "@/lib/publish-service";
import { WechatSyncStatus } from "./wechatsync-status";
import { MCPConfigComponent } from "./mcp-config";
import { ArticleSyncStatus } from "./article-sync-status";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PublishAccountsSettingsProps {
  className?: string;
}

export function PublishAccountsSettings({
  className,
}: PublishAccountsSettingsProps) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<PublishAccount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // 新账号表单
  const [newAccount, setNewAccount] = useState<{
    name: string;
    type: PlatformType;
  }>({
    name: "",
    type: "zhihu",
  });

  // 编辑表单
  const [editForm, setEditForm] = useState<{
    name: string;
    type: PlatformType;
  }>({
    name: "",
    type: "zhihu",
  });

  // 加载账号列表
  useEffect(() => {
    setAccounts(getPublishAccounts());
  }, []);

  // 刷新账号列表
  const refreshAccounts = () => {
    setAccounts(getPublishAccounts());
  };

  // 开始添加账号
  const handleStartAdd = () => {
    setIsAdding(true);
    setNewAccount({ name: "", type: "zhihu" });
  };

  // 取消添加
  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewAccount({ name: "", type: "zhihu" });
  };

  // 确认添加
  const handleConfirmAdd = () => {
    if (!newAccount.name.trim()) {
      toast.error("请输入账号名称");
      return;
    }

    if (isAccountNameExists(newAccount.name)) {
      toast.error("账号名称已存在");
      return;
    }

    try {
      const account: PublishAccount = {
        id: generateAccountId(),
        type: newAccount.type,
        name: newAccount.name.trim(),
        config: {},
      };

      addPublishAccount(account);
      refreshAccounts();
      handleCancelAdd();
      toast.success("账号添加成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败");
    }
  };

  // 开始编辑
  const handleStartEdit = (account: PublishAccount) => {
    setEditingId(account.id);
    setEditForm({ name: account.name, type: account.type });
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", type: "zhihu" });
  };

  // 确认编辑
  const handleConfirmEdit = () => {
    if (!editForm.name.trim()) {
      toast.error("请输入账号名称");
      return;
    }

    if (isAccountNameExists(editForm.name, editingId ?? undefined)) {
      toast.error("账号名称已存在");
      return;
    }

    const account = accounts.find((a) => a.id === editingId);
    if (!account) {
      return;
    }

    try {
      const updated: PublishAccount = {
        ...account,
        name: editForm.name.trim(),
        type: editForm.type,
      };

      updatePublishAccount(updated);
      refreshAccounts();
      handleCancelEdit();
      toast.success("账号更新成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    }
  };

  // 删除账号
  const handleDelete = (accountId: string) => {
    if (!confirm("确定要删除这个账号吗？")) {
      return;
    }

    try {
      deletePublishAccount(accountId);
      refreshAccounts();
      toast.success("账号删除成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Article Sync JS（推荐） */}
      <ArticleSyncStatus />

      {/* MCP Server 配置（备选） */}
      <MCPConfigComponent />

      {/* WechatSync 插件状态（可选） */}
      <WechatSyncStatus />

      {/* 手动添加账号 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">手动添加账号</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartAdd}
            disabled={isAdding}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            添加账号
          </Button>
        </div>

        {/* 添加表单 */}
      {isAdding && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">账号名称</label>
              <Input
                placeholder="例如：我的知乎账号"
                value={newAccount.name}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, name: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">平台类型</label>
              <Select
                value={newAccount.type}
                onValueChange={(value) =>
                  setNewAccount({ ...newAccount, type: value as PlatformType })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      <span className="flex items-center gap-2">
                        <span>{getPlatformIcon(platform)}</span>
                        <span>{getPlatformName(platform)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelAdd}>
              <XIcon className="mr-1 h-3 w-3" />
              取消
            </Button>
            <Button size="sm" onClick={handleConfirmAdd}>
              <CheckIcon className="mr-1 h-3 w-3" />
              确认
            </Button>
          </div>
        </div>
      )}

      {/* 账号列表 */}
      {accounts.length === 0 && !isAdding ? (
        <div className="text-muted-foreground text-center py-8 text-sm">
          暂无发布账号，点击上方按钮添加
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const isEditing = editingId === account.id;

            return (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                {isEditing ? (
                  <>
                    <div className="flex flex-1 gap-2">
                      <Input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        className="flex-1"
                      />
                      <Select
                        value={editForm.type}
                        onValueChange={(value) =>
                          setEditForm({ ...editForm, type: value as PlatformType })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              <span className="flex items-center gap-2">
                                <span>{getPlatformIcon(platform)}</span>
                                <span>{getPlatformName(platform)}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleConfirmEdit}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleCancelEdit}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-lg">{getPlatformIcon(account.type)}</span>
                    <div className="flex-1">
                      <div className="font-medium">{account.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {getPlatformName(account.type)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleStartEdit(account)}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(account.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
