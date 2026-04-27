"use client";

import { Bot, Loader2, User, Wrench } from "lucide-react";
import { useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { ChatMessage, ChatToolCall } from "./types";

/**
 * ChatMessageList — 从 ChatMessage[] 渲染对话消息列表
 */
export function ChatMessageList({
  messages,
  optimisticMessages,
  sessionStatus,
  className,
}: {
  messages: ChatMessage[];
  optimisticMessages?: ChatMessage[];
  sessionStatus: string;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 合并服务端消息和 optimistic 消息
  const allMessages = [...messages, ...(optimisticMessages ?? [])];

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages.length]);

  const isStreaming =
    sessionStatus === "streaming" || sessionStatus === "waiting_human";

  return (
    <ScrollArea className={cn("flex-1", className)} ref={scrollRef}>
      <div className="flex flex-col gap-4 p-4">
        {allMessages && allMessages.length > 0 && (         
          allMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {isStreaming && allMessages.length > 0 && (
          <div className="flex items-center gap-2 px-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span className="text-muted-foreground text-xs">
              AI 正在思考...
            </span>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── 消息气泡 ───

function MessageBubble({ message }: { message: ChatMessage }) {
  const isHuman = message.type === "human";
  const isSystem = message.type === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-muted rounded-md px-3 py-1.5 text-center text-xs text-muted-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3",
        isHuman ? "flex-row-reverse" : "flex-row",
      )}
    >
      
      {/* 消息内容 */}
      <div
        className={cn(
          "max-w-[100%]",
          isHuman ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isHuman
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          {/* 推理内容 */}
          {message.reasoningContent && (
            <details className="mb-2 cursor-pointer">
              <summary className="text-muted-foreground text-xs hover:underline">
                推理过程
              </summary>
              <pre className="bg-muted/50 mt-1 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">
                {message.reasoningContent}
              </pre>
            </details>
          )}

          {/* 消息正文 
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
          */}

          {/* 流式指示 */}
          {message.isStreaming && (
            <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-current" />
          )}
        </div>

        {/* 工具调用 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 工具调用卡片 ───

function ToolCallCard({ toolCall }: { toolCall: ChatToolCall }) {
  return (
    <div className="bg-muted/50 rounded-lg border p-2.5 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <Wrench className="size-3" />
        <span>{toolCall.name}</span>
      </div>
      {toolCall.args && (
        <pre className="mt-1 max-h-24 overflow-auto rounded bg-background/50 p-1.5 font-mono text-[10px] whitespace-pre-wrap">
          {JSON.stringify(toolCall.args, null, 2)}
        </pre>
      )}
      {toolCall.result !== undefined && (
        <div className="mt-1.5 border-t pt-1.5">
          <span className="text-muted-foreground font-medium">结果:</span>
          <pre className="mt-0.5 max-h-24 overflow-auto rounded bg-background/50 p-1.5 font-mono text-[10px] whitespace-pre-wrap">
            {typeof toolCall.result === "string"
              ? toolCall.result
              : JSON.stringify(toolCall.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
