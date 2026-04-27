/**
 * useChatEvents — 封装事件订阅 + Runtime Event → ChatMessage 转换
 *
 * 委托 useRuntimeEvents，额外提供 messages（从 events 提取的 ChatMessage[]）和 todos。
 */

"use client";

import { useMemo, useCallback } from "react";

import { useRuntimeEvents } from "@/core/studio/hooks/use-runtime-events";
import type { RuntimeEvent } from "@/core/studio/types/runtime";
import type { Todo } from "@/core/todos";

import type { ChatMessage, ChatToolCall } from "../types";

// ─── 事件 → 消息转换 ───

/**
 * 将 RuntimeEvent[] 转换为 ChatMessage[]。
 *
 * 转换规则：
 * - message_delta (source=user)   → human ChatMessage（isStreaming=true）
 * - message_delta (source=assistant) → ai ChatMessage（isStreaming=true）
 * - message_final                  → 标记对应消息 isStreaming=false
 * - tool_call                      → ChatToolCall 追加到当前 ai 消息
 * - tool_result                    → 更新对应 ChatToolCall.result
 * - error                          → system ChatMessage
 * - interrupt / resume / run_start / run_end 等 → 跳过（由其他面板处理）
 */
function eventsToMessages(events: RuntimeEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  /** 当前正在构建的 AI 消息索引（用于追加 toolCalls / delta） */
  let currentAiIdx = -1;

  for (const ev of events) {
    const { eventType, source, display, createdAt, eventId } = ev;

    switch (eventType) {
      case "message_delta": {
        const isHuman = source === "user";
        const msg: ChatMessage = {
          id: eventId,
          type: isHuman ? "human" : "ai",
          content: display.content ?? "",
          timestamp: createdAt,
          isStreaming: true,
        };
        if (!isHuman) {
          currentAiIdx = messages.length;
        }
        messages.push(msg);
        break;
      }

      case "message_final": {
        const isHuman = source === "user";
        const msg: ChatMessage = {
          id: eventId,
          type: isHuman ? "human" : "ai",
          content: display.content ?? "",
          timestamp: createdAt,
          isStreaming: false,
        };
        if (!isHuman) {
          currentAiIdx = messages.length;
        }
        messages.push(msg);
        break;
      }

      case "tool_call": {
        const tc: ChatToolCall = {
          id: eventId,
          name: display.title ?? "tool",
          args: display.content ? tryParseJson(display.content) : undefined,
        };
        if (currentAiIdx >= 0 && messages[currentAiIdx]) {
          const aiMsg = messages[currentAiIdx]!;
          aiMsg.toolCalls = [...(aiMsg.toolCalls ?? []), tc];
        } else {
          // 没有 AI 消息上下文，创建一条新的 AI 消息承载 toolCall
          const msg: ChatMessage = {
            id: `tc-${eventId}`,
            type: "ai",
            content: "",
            timestamp: createdAt,
            toolCalls: [tc],
            isStreaming: true,
          };
          currentAiIdx = messages.length;
          messages.push(msg);
        }
        break;
      }

      case "tool_result": {
        // 尝试更新最后一个 toolCall 的 result
        if (currentAiIdx >= 0 && messages[currentAiIdx]?.toolCalls) {
          const calls = messages[currentAiIdx]!.toolCalls!;
          const lastCall = calls[calls.length - 1];
          if (lastCall) {
            lastCall.result = display.content
              ? tryParseJson(display.content)
              : display.content;
          }
        }
        break;
      }

      case "error": {
        messages.push({
          id: eventId,
          type: "system",
          content: display.content ?? display.title ?? "发生错误",
          timestamp: createdAt,
        });
        break;
      }

      // interrupt / resume / run_start / run_end / value_snapshot / custom_event / subgraph_event / result_materialized / document_persisted
      // 这些事件不生成 ChatMessage，由 HITL 面板 / 时间线 / 结果面板处理
      default:
        break;
    }
  }

  return mergeConsecutiveMessages(messages);
}

/**
 * 合并连续的同类型消息（将多个 message_delta 合并为一条消息）。
 */
function mergeConsecutiveMessages(msgs: ChatMessage[]): ChatMessage[] {
  if (msgs.length === 0) return [];

  const result: ChatMessage[] = [msgs[0]!];

  for (let i = 1; i < msgs.length; i++) {
    const curr = msgs[i]!;
    const prev = result[result.length - 1]!;

    if (
      curr.type === prev.type &&
      curr.type !== "system" &&
      !curr.toolCalls?.length &&
      !prev.toolCalls?.length
    ) {
      // 合并：追加 content，保留最后的 isStreaming 状态
      prev.content += curr.content;
      prev.isStreaming = curr.isStreaming;
      prev.timestamp = curr.timestamp;
    } else {
      result.push(curr);
    }
  }

  return result;
}

function tryParseJson(text: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

// ─── Hook ───

export function useChatEvents(sessionId: string | undefined) {
  debugger;
  const { events, isLive, reconnect, reload } = useRuntimeEvents(sessionId);

  const messages = useMemo(() => eventsToMessages(events), [events]);

  // 从 events 中提取 todos（来自 write_todos 工具调用）
  const todos = useMemo(() => extractTodos(events), [events]);

  const reconnectFn = useCallback(() => {
    reconnect();
  }, [reconnect]);

  return {
    events,
    messages,
    todos,
    isLive,
    reconnect: reconnectFn,
    reload,
  };
}

// ─── Todos 提取 ───

/**
 * 从 Runtime Events 中提取 todos。
 *
 * 查找 tool_call 事件中 name 为 "write_todos" 的调用，
 * 从其 args 或 result 中解析 todos 数组。
 */
function extractTodos(events: RuntimeEvent[]): Todo[] {
  for (const ev of events) {
    if (ev.eventType !== "tool_call") continue;
    if (ev.display.title !== "write_todos") continue;

    const content = ev.display.content;
    if (!content) continue;

    const parsed = tryParseJson(content);
    if (!parsed) continue;

    // 尝试从 args.todos 或直接从 parsed 提取
    const todosArray =
      (parsed as { todos?: Todo[] }).todos ??
      (Array.isArray(parsed) ? (parsed as Todo[]) : null);

    if (Array.isArray(todosArray)) {
      return todosArray;
    }
  }

  return [];
}

// 导出转换函数供测试使用
export { eventsToMessages };
