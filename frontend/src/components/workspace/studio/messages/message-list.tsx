import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { useI18n } from "@/core/i18n/hooks";
import { useRehypeSplitWordsIntoSpans } from "@/core/rehype";
import { cn } from "@/lib/utils";

import { StreamingIndicator } from "../../streaming-indicator";

import type { ChatMessage } from "../chat/types";
import { MarkdownContent } from "./markdown-content";
import { MessageGroup } from "./message-group";
import { MessageListItem } from "./message-list-item";
import { MessageListSkeleton } from "./skeleton";

export const MESSAGE_LIST_DEFAULT_PADDING_BOTTOM = 160;
export const MESSAGE_LIST_FOLLOWUPS_EXTRA_PADDING_BOTTOM = 80;

export function MessageList({
  className,
  messages,
  optimisticMessages,
  isLoading = false,
  isThreadLoading = false,
  paddingBottom = MESSAGE_LIST_DEFAULT_PADDING_BOTTOM,
}: {
  className?: string;
  messages: ChatMessage[];
  optimisticMessages?: ChatMessage[];
  isLoading?: boolean;
  isThreadLoading?: boolean;
  paddingBottom?: number;
}) {
  const { t } = useI18n();
  const rehypePlugins = useRehypeSplitWordsIntoSpans(isLoading);

  // 合并服务端消息和 optimistic 消息
  const allMessages = [...messages, ...(optimisticMessages ?? [])];

  if (isThreadLoading && allMessages.length === 0) {
    return <MessageListSkeleton />;
  }

  return (
    <Conversation
      className={cn("flex size-full flex-col justify-center", className)}
    >
      <ConversationContent className="mx-auto w-full max-w-(--container-width-md) gap-8 pt-12">
        {groupMessages(allMessages, (group) => {
          if (group.type === "human" || group.type === "assistant") {
            return group.messages.map((msg) => {
              return (
                <MessageListItem
                  key={`${group.id}/${msg.id}`}
                  message={msg}
                  isLoading={isLoading}
                />
              );
            });
          } else if (group.type === "assistant:clarification") {
           
            const message = group.messages[0];
            if (message && message.content) {
              return (
                <MarkdownContent
                  key={group.id}
                  content={message.content}
                  isLoading={isLoading}
                  rehypePlugins={rehypePlugins}
                />
              );
            }
              
            return null;
          }
          return (
            <MessageGroup
              key={"group-" + group.id}
              messages={group.messages}
              isLoading={isLoading}
            />
          );
        })}
        {isLoading && <StreamingIndicator className="my-4" />}
        <div style={{ height: `${paddingBottom}px` }} />
      </ConversationContent>
    </Conversation>
  );
}

// ─── 消息分组逻辑 ───

interface MessageGroup {
  id: string;
  type: "human" | "assistant" | "assistant:clarification" | "assistant:tool";
  messages: ChatMessage[];
}

function groupMessages(
  messages: ChatMessage[],
  callback: (group: MessageGroup) => React.ReactNode,
): React.ReactNode[] {
  if (messages.length === 0) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const msg of messages) {
    const groupType = getGroupType(msg);

    if (!currentGroup || currentGroup.type !== groupType) {
      // 开始新分组
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        id: msg.id,
        type: groupType,
        messages: [msg],
      };
    } else {
      // 追加到当前分组
      currentGroup.messages.push(msg);
    }
  }

  // 添加最后一个分组
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups.map((group) => callback(group));
}

function getGroupType(msg: ChatMessage): MessageGroup["type"] {
  if (msg.type === "human") {
    return "human";
  }

  // 检查是否有 clarification 标记
  if (msg.toolCalls?.some((tc) => tc.name === "ask_clarification")) {
    return "assistant:clarification";
  }

  // 检查是否有工具调用
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    return "assistant:tool";
  }

  return "assistant";
}
