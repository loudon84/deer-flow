/**
 * useChatMessageSend — 封装消息发送逻辑（含 optimistic 消息）
 *
 * 管理 optimistic 消息列表，提供 sendMessage / stop 方法。
 */

"use client";

import { useCallback, useRef, useState } from "react";

import type { RuntimeRequestContext } from "@/core/studio/types/runtime";

import type { ChatMessage } from "../types";

export function useChatMessageSend(params: {
  sessionId: string | undefined;
  ensureSessionAndRun: (
    message: string,
    context?: Partial<RuntimeRequestContext>,
  ) => Promise<void>;
}) {
  const { sessionId, ensureSessionAndRun } = params;

  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>(
    [],
  );
  const [isSending, setIsSending] = useState(false);
  const sendInFlightRef = useRef(false);

  const sendMessage = useCallback(
    async (
      text: string,
      context?: Partial<RuntimeRequestContext>,
    ) => {
      const trimmed = text.trim();
      if (!trimmed || sendInFlightRef.current) return;

      sendInFlightRef.current = true;
      setIsSending(true);

      // 创建 optimistic human 消息
      const optimisticMsg: ChatMessage = {
        id: `opt-human-${Date.now()}`,
        type: "human",
        content: trimmed,
        timestamp: new Date().toISOString(),
        isStreaming: false,
      };
      setOptimisticMessages([optimisticMsg]);

      try {
        await ensureSessionAndRun(trimmed, context);
        // 成功后清空 optimistic（服务端事件会通过 SSE 到达）
        setOptimisticMessages([]);
      } catch {
        // 失败时保留 optimistic 消息，标记错误
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMsg.id
              ? { ...m, type: "system", content: `${m.content}（发送失败）` }
              : m,
          ),
        );
      } finally {
        sendInFlightRef.current = false;
        setIsSending(false);
      }
    },
    [ensureSessionAndRun],
  );

  const stop = useCallback(() => {
    // 标记本地停止（实际取消由后端处理）
    sendInFlightRef.current = false;
    setIsSending(false);
    setOptimisticMessages([]);
  }, []);

  return {
    optimisticMessages,
    isSending,
    sendMessage,
    stop,
    /** 当前是否有活跃的 Session */
    hasSession: !!sessionId,
  };
}
