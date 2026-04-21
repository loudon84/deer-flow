"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createRuntimeSession,
  getRuntimeSession,
  startRuntimeRun,
} from "@/core/studio/api/runtime-sessions";
import { useDocument } from "@/core/studio/hooks/use-documents";
import { useRuntimeEvents } from "@/core/studio/hooks/use-runtime-events";
import { useRuntimeSession } from "@/core/studio/hooks/use-runtime-session";
import type {
  ApplyMode,
  RuntimeRequestContext,
} from "@/core/studio/types/runtime";

import { RuntimeInterruptPanel } from "./RuntimeInterruptPanel";
import { RuntimeResultPanel } from "./RuntimeResultPanel";
import { RuntimeSessionTabs } from "./RuntimeSessionTabs";
import { RuntimeStatusCard } from "./RuntimeStatusCard";
import { RuntimeTimeline } from "./RuntimeTimeline";

const DEFAULT_RC: RuntimeRequestContext = {
  modelName: "gpt-4o",
  mode: "pro",
  reasoningEffort: "medium",
  thinkingEnabled: true,
  planMode: false,
  subagentEnabled: false,
};

export function RuntimePanel({
  ownerType,
  ownerId,
  autoCreate,
  showSessionTabs,
  documentId,
  mode,
  isDocumentDirty,
  onApplyRequest,
}: {
  ownerType: "job" | "document";
  ownerId: string;
  autoCreate: boolean;
  showSessionTabs?: boolean;
  /** For apply result; defaults to ownerId in document mode */
  documentId?: string;
  mode: "job" | "document";
  isDocumentDirty?: boolean;
  onApplyRequest?: (applyMode: ApplyMode) => Promise<boolean>;
}) {
  const queryClient = useQueryClient();
  const docQuery = useDocument(ownerType === "document" ? ownerId : "");

  const jobRuntime = useRuntimeSession({
    ownerType: "job",
    ownerId,
    autoCreate,
    enabled: ownerType === "job",
  });

  const [docSessionId, setDocSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (ownerType !== "document") return;
    const latest = docQuery.data?.latest_runtime_session_id;
    const ids = docQuery.data?.runtime_session_ids;
    if (latest) {
      setDocSessionId(latest);
    } else if (ids && ids.length > 0) {
      setDocSessionId(ids[ids.length - 1] ?? null);
    } else {
      setDocSessionId(null);
    }
  }, [ownerType, docQuery.data]);

  const createDocSession = useMutation({
    mutationFn: async () => {
      const res = await createRuntimeSession({
        ownerType: "document",
        ownerId,
        requestContext: DEFAULT_RC,
      });
      return res.sessionId;
    },
    onSuccess: async (id) => {
      setDocSessionId(id);
      await queryClient.invalidateQueries({
        queryKey: ["article-studio", "documents", ownerId],
      });
      toast.success("已创建文档级 Runtime 会话");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "创建失败");
    },
  });

  const sessionId =
    ownerType === "job" ? jobRuntime.sessionId ?? undefined : docSessionId ?? undefined;

  const documentSessionQuery = useQuery({
    queryKey: ["article-studio", "runtime-session", docSessionId],
    queryFn: () => getRuntimeSession(docSessionId!),
    enabled: ownerType === "document" && !!docSessionId,
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      if (st === "streaming" || st === "waiting_human") return 3000;
      return false;
    },
  });

  const session =
    ownerType === "job"
      ? jobRuntime.session
      : documentSessionQuery.data ?? null;

  const sessionLoading =
    ownerType === "job"
      ? jobRuntime.isLoading
      : docQuery.isLoading || (!!docSessionId && documentSessionQuery.isLoading);

  const { events, isLive, reconnect } = useRuntimeEvents(sessionId);

  const [runMessage, setRunMessage] = useState(
    "请根据当前文档上下文进行续写或改写。",
  );

  const onStartRun = async () => {
    if (!sessionId || !runMessage.trim()) return;
    try {
      await startRuntimeRun(sessionId, { message: runMessage });
      toast.success("已提交运行");
      void queryClient.invalidateQueries({
        queryKey: ["article-studio", "runtime-session", sessionId],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "启动失败");
    }
  };

  const sessionIds = docQuery.data?.runtime_session_ids ?? [];
  const effectiveDocId = documentId ?? ownerId;

  if (ownerType === "job" && jobRuntime.error) {
    return (
      <div className="text-destructive text-sm">
        {String(jobRuntime.error)}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {showSessionTabs && ownerType === "document" && sessionIds.length > 0 ? (
        <RuntimeSessionTabs
          sessionIds={sessionIds}
          selectedSessionId={docSessionId}
          onSelect={(id) => setDocSessionId(id)}
        />
      ) : null}

      {ownerType === "document" && !docSessionId && !docQuery.isLoading ? (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <p className="text-muted-foreground text-sm">
            尚未关联 Runtime 会话。可创建新会话后在右侧查看时间线与 AI 结果。
          </p>
          <Button
            size="sm"
            disabled={createDocSession.isPending}
            onClick={() => createDocSession.mutate()}
          >
            {createDocSession.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                创建中…
              </>
            ) : (
              "创建 Runtime 会话"
            )}
          </Button>
        </div>
      ) : null}

      {sessionLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          加载 Runtime…
        </div>
      ) : (
        <>
          <RuntimeStatusCard session={session} isLive={isLive} />
          <RuntimeInterruptPanel session={session} />
          {ownerType === "document" && sessionId ? (
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs">发起 Run（续写/改写）</Label>
              <Textarea
                className="min-h-[80px] text-sm"
                value={runMessage}
                onChange={(e) => setRunMessage(e.target.value)}
              />
              <Button size="sm" onClick={() => void onStartRun()}>
                发送并运行
              </Button>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">事件时间线</span>
            <Button variant="ghost" size="sm" onClick={() => reconnect()}>
              刷新
            </Button>
          </div>
          <RuntimeTimeline events={events} />
          <RuntimeResultPanel
            sessionId={sessionId}
            documentId={mode === "document" ? effectiveDocId : undefined}
            mode={mode}
            isDocumentDirty={isDocumentDirty}
            onApplyRequest={onApplyRequest}
          />
        </>
      )}
    </div>
  );
}
