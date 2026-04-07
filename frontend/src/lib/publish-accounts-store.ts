/**
 * 发布账号管理 Store
 * 使用 localStorage 持久化存储账号信息
 */

import type { PublishAccount, PlatformType } from "./publish-service";

const STORAGE_KEY = "deerflow-publish-accounts";

/**
 * 获取所有发布账号
 */
export function getPublishAccounts(): PublishAccount[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }
    return JSON.parse(data) as PublishAccount[];
  } catch (error) {
    console.error("Failed to load publish accounts:", error);
    return [];
  }
}

/**
 * 保存发布账号列表
 */
export function savePublishAccounts(accounts: PublishAccount[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error("Failed to save publish accounts:", error);
  }
}

/**
 * 添加发布账号
 */
export function addPublishAccount(account: PublishAccount): void {
  const accounts = getPublishAccounts();
  const existing = accounts.find((a) => a.id === account.id);

  if (existing) {
    throw new Error(`账号 ID ${account.id} 已存在`);
  }

  accounts.push(account);
  savePublishAccounts(accounts);
}

/**
 * 更新发布账号
 */
export function updatePublishAccount(account: PublishAccount): void {
  const accounts = getPublishAccounts();
  const index = accounts.findIndex((a) => a.id === account.id);

  if (index === -1) {
    throw new Error(`账号 ID ${account.id} 不存在`);
  }

  accounts[index] = account;
  savePublishAccounts(accounts);
}

/**
 * 删除发布账号
 */
export function deletePublishAccount(accountId: string): void {
  const accounts = getPublishAccounts();
  const filtered = accounts.filter((a) => a.id !== accountId);
  savePublishAccounts(filtered);
}

/**
 * 根据平台类型获取账号
 */
export function getAccountsByPlatform(platform: PlatformType): PublishAccount[] {
  const accounts = getPublishAccounts();
  return accounts.filter((a) => a.type === platform);
}

/**
 * 检查账号名称是否已存在
 */
export function isAccountNameExists(name: string, excludeId?: string): boolean {
  const accounts = getPublishAccounts();
  return accounts.some((a) => a.name === name && a.id !== excludeId);
}

/**
 * 生成唯一账号 ID
 */
export function generateAccountId(): string {
  return `account-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
