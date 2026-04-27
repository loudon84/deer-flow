/**
 * Studio Chat — 类型定义
 *
 * 复用 @/core/studio/types/runtime 中的类型，
 * 新增 ChatMessage / ChatToolCall 作为 Runtime Event → UI 渲染的中间转换层。
 */

import type {
  ApplyMode,
  RuntimeEvent,
  RuntimeRequestContext,
  RuntimeSessionStatus,
} from "@/core/studio/types/runtime";

// ─── 重新导出复用类型 ───

export type {
  ApplyMode,
  RuntimeEvent,
  RuntimeRequestContext,
  RuntimeSessionStatus,
};

// ─── Chat 专用类型 ───

/** 从 Runtime Events 提取的对话消息（兼容 Chats MessageGroup 渲染） */
export interface ChatMessage {
  id: string;
  type: "human" | "ai" | "system";
  content: string;
  timestamp: string;
  toolCalls?: ChatToolCall[];
  reasoningContent?: string;
  isStreaming?: boolean;
}

/** 工具调用摘要 */
export interface ChatToolCall {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

/** Chat 面板本地状态 */
export interface ChatPanelState {
  requestContext: RuntimeRequestContext;
  showTimeline: boolean;
  showFollowups: boolean;
}
