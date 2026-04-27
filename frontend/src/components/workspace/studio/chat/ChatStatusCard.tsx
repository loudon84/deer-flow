"use client";

import { RuntimeStatusCard } from "@/components/workspace/studio/runtime/RuntimeStatusCard";
import type { RuntimeSession } from "@/core/studio/types/runtime";

import { cn } from "@/lib/utils";

/**
 * ChatStatusCard — 复用 RuntimeStatusCard 的薄包装组件
 */
export function ChatStatusCard({
  session,
  isLive,
  className,
}: {
  session: RuntimeSession | null;
  isLive?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <RuntimeStatusCard session={session} isLive={isLive} />
    </div>
  );
}
