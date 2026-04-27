"use client";

import {
  PromptInputProvider,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { TodoList } from "@/components/workspace/todo-list";
import type { ApplyMode } from "@/core/studio/types/runtime";
import { cn } from "@/lib/utils";

import { ChatEventTimeline } from "./ChatEventTimeline";
import { ChatHITLPanel } from "./ChatHITLPanel";
import { ChatInputBox } from "./ChatInputBox";
import { ChatResultPanel } from "./ChatResultPanel";
import { ChatStatusCard } from "./ChatStatusCard";
import { useChatEvents } from "./hooks/use-chat-events";
import { useChatMessageSend } from "./hooks/use-chat-message-send";
import { useChatSession } from "./hooks/use-chat-session";
import type { RuntimeRequestContext } from "./types";
import { MessageList } from "../messages";

// ─── 默认 Request Context ───

const DEFAULT_REQUEST_CONTEXT: RuntimeRequestContext = {
  modelName: "gpt-4o",
  mode: "pro",
  reasoningEffort: "medium",
  thinkingEnabled: true,
  planMode: false,
  subagentEnabled: false,
};

// ─── localStorage 持久化 key ───

function getStorageKey(ownerId: string) {
  return `deerflow.studio-chat-rc.${ownerId}`;
}

function loadRequestContext(ownerId: string): RuntimeRequestContext {
  if (typeof window === "undefined") return DEFAULT_REQUEST_CONTEXT;
  try {
    const raw = localStorage.getItem(getStorageKey(ownerId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RuntimeRequestContext>;
      return { ...DEFAULT_REQUEST_CONTEXT, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_REQUEST_CONTEXT;
}

function saveRequestContext(ownerId: string, ctx: RuntimeRequestContext) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(ownerId), JSON.stringify(ctx));
  } catch {
    // ignore
  }
}

// ─── Props ───

export interface StudioChatPanelProps {
  ownerType: "job" | "document";
  ownerId: string;
  autoCreate?: boolean;
  /** 结果应用目标文档 ID（默认取 ownerId） */
  documentId?: string;
  /** 编辑器有未保存修改 */
  isDocumentDirty?: boolean;
  /** 应用结果前的确认回调（脏文档时触发） */
  onApplyRequest?: (applyMode: ApplyMode) => Promise<boolean>;
  className?: string;
}

// ─── 组件 ───

export function StudioChatPanel({
  ownerType,
  ownerId,
  autoCreate = true,
  documentId,
  isDocumentDirty,
  onApplyRequest,
  className,
}: StudioChatPanelProps) {
  // Session 管理
  const chatSession = useChatSession({
    ownerType,
    ownerId,
    autoCreate,
  });

  // 事件订阅 + 消息提取
  const { events, messages, todos, isLive, reconnect } = useChatEvents(
    chatSession.sessionId ?? undefined,
  );

  // 消息发送
  const messageSend = useChatMessageSend({
    sessionId: chatSession.sessionId ?? undefined,
    ensureSessionAndRun: chatSession.ensureSessionAndRun,
  });

  // Request Context（持久化到 localStorage）
  const [requestContext, setRequestContext] = useState<RuntimeRequestContext>(
    () => loadRequestContext(ownerId),
  );

  const handleContextChange = useCallback(
    (ctx: RuntimeRequestContext) => {
      setRequestContext(ctx);
      saveRequestContext(ownerId, ctx);
    },
    [ownerId],
  );

  // 发送消息
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text?.trim();
      if (!text) return;
      await messageSend.sendMessage(text, requestContext);
    },
    [messageSend, requestContext],
  );

  // 停止运行
  const handleStop = useCallback(() => {
    messageSend.stop();
  }, [messageSend]);

  // 加载状态
  if (chatSession.isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          className,
        )}
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground ml-2 text-sm">
          初始化 Runtime 会话...
        </span>
      </div>
    );
  }

  // 错误状态
  if (chatSession.error) {
    return (
      <div className={cn("p-4", className)}>
        <div className="text-destructive text-sm">
          {String(chatSession.error)}
        </div>
      </div>
    );
  }

  const session = chatSession.session;
  const sessionStatus = session?.status ?? "idle";
  const effectiveDocId = documentId ?? ownerId;
  const resultMode = ownerType;
  console.log(chatSession.sessionId)
  
  return (
    <PromptInputProvider>
      <div className={cn("flex min-h-0 flex-col gap-3", className)}>
        {/* 顶部状态栏 */}
        <ChatStatusCard session={session} isLive={isLive} />
        
             
        {/* 消息列表 */}
        {sessionStatus !== 'completed' && (    
          <MessageList
            className="flex-1"
            messages={messages}
            optimisticMessages={messageSend.optimisticMessages}
            isLoading={sessionStatus === "streaming" || sessionStatus === "waiting_human"}
          />
        )}
        {/* HITL 面板（waiting_human 时显示） */}
        {sessionStatus !== 'completed' && (  
          <ChatHITLPanel session={session} />
        )}
        {/* 结果应用面板（completed 同时非 isLive 时显示） */}
        {sessionStatus === "completed" && (
          <ChatResultPanel
            sessionId={chatSession.sessionId ?? undefined}
            documentId={resultMode === "document" ? effectiveDocId : undefined}
            mode={resultMode}
            isDocumentDirty={isDocumentDirty}
            onApplyRequest={onApplyRequest}
          />
        )}

        {/* 事件时间线（可折叠） */}
        <ChatEventTimeline
          events={events}
          isLive={isLive}
          onReconnect={reconnect}
        />

        {/* TodoList（待办事项） */}
        <div className="relative">
          <div className="absolute right-0 bottom-0 left-0">
            <TodoList
              className="bg-background/5"
              todos={todos}
              hidden={!todos || todos.length === 0}
            />
          </div>
        </div>

        {/* 底部输入框 */}
        <ChatInputBox
          sessionId={chatSession.sessionId ?? undefined}
          sessionStatus={sessionStatus}
          requestContext={requestContext}
          onContextChange={handleContextChange}
          onSubmit={handleSubmit}
          onStop={handleStop}
          disabled={!chatSession.sessionId}
        />
      </div>
    </PromptInputProvider>
  );
}
