"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useApplyRuntimeResult,
  useLatestRuntimeResult,
} from "@/core/studio/hooks/use-runtime-result-apply";
import type { ApplyMode } from "@/core/studio/types/runtime";

export function RuntimeResultPanel({
  sessionId,
  documentId,
  mode,
  isDocumentDirty,
  onApplyRequest,
}: {
  sessionId: string | undefined;
  /** When set, show apply buttons */
  documentId?: string;
  mode: "job" | "document";
  /** Editor has unsaved changes */
  isDocumentDirty?: boolean;
  /** Called before apply when dirty — should run confirm dialog and return Promise<boolean> */
  onApplyRequest?: (applyMode: ApplyMode) => Promise<boolean>;
}) {
  const latest = useLatestRuntimeResult(sessionId);
  const apply = useApplyRuntimeResult(documentId);

  const r = latest.data;

  const handleApply = async (applyMode: ApplyMode) => {
    if (!documentId || !r?.resultId) {
      toast.error("无可应用结果");
      return;
    }
    if (isDocumentDirty) {
      const ok = await onApplyRequest?.(applyMode);
      if (!ok) return;
    }
    try {
      await apply.mutateAsync({
        resultId: r.resultId,
        payload: { applyMode },
      });
      toast.success("已应用到文档");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "应用失败");
    }
  };

  if (latest.isLoading && !r) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">AI 结果</CardTitle>
          <CardDescription>加载中…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!r) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">AI 结果</CardTitle>
          <CardDescription>暂无物化结果（运行结束后将出现）</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">AI 结果预览</CardTitle>
        <CardDescription>
          {r.resultType}
          {r.createdAt ? ` · ${r.createdAt}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {r.title ? (
          <p className="text-sm font-medium">{r.title}</p>
        ) : null}
        <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
          {r.content ?? "(空)"}
        </pre>
        {mode === "document" && documentId ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={apply.isPending}
              onClick={() => void handleApply("replace")}
            >
              替换正文
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={apply.isPending}
              onClick={() => void handleApply("append")}
            >
              追加
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={apply.isPending}
              onClick={() => void handleApply("new_version")}
            >
              新版本
            </Button>
          </div>
        ) : null}
        {mode === "document" && isDocumentDirty ? (
          <p className="text-amber-600 text-xs dark:text-amber-400">
            编辑器有未保存更改时，应用前将提示确认。
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
