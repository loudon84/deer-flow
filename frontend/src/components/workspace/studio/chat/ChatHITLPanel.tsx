"use client";

import { RuntimeInterruptPanel } from "@/components/workspace/studio/runtime/RuntimeInterruptPanel";
import type { RuntimeSession } from "@/core/studio/types/runtime";

/**
 * ChatHITLPanel — 复用 RuntimeInterruptPanel 的薄包装组件
 *
 * 仅当 session.status === "waiting_human" 时渲染。
 */
export function ChatHITLPanel({
  session,
}: {
  session: RuntimeSession | null;
}) {
  if (session?.status !== "waiting_human") {
    return null;
  }

  return <RuntimeInterruptPanel session={session} />;
}
