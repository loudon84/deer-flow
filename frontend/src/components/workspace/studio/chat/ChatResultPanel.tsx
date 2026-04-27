"use client";

import { RuntimeResultPanel } from "@/components/workspace/studio/runtime/RuntimeResultPanel";
import type { ApplyMode } from "@/core/studio/types/runtime";

/**
 * ChatResultPanel — 复用 RuntimeResultPanel 的薄包装组件
 *
 * 当 Session 完成且存在物化结果时展示结果预览和应用操作。
 */
export function ChatResultPanel({
  sessionId,
  documentId,
  mode,
  isDocumentDirty,
  onApplyRequest,
}: {
  sessionId: string | undefined;
  documentId?: string;
  mode: "job" | "document";
  isDocumentDirty?: boolean;
  onApplyRequest?: (applyMode: ApplyMode) => Promise<boolean>;
}) {
  return (
    <RuntimeResultPanel
      sessionId={sessionId}
      documentId={documentId}
      mode={mode}
      isDocumentDirty={isDocumentDirty}
      onApplyRequest={onApplyRequest}
    />
  );
}
