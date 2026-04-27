/**
 * useChatSession — 封装 Runtime Session 生命周期管理
 *
 * 委托 useRuntimeSession，额外提供 ensureSessionAndRun 便捷方法。
 */

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { startRuntimeRun } from "@/core/studio/api/runtime-sessions";
import { useRuntimeSession } from "@/core/studio/hooks/use-runtime-session";
import type { RuntimeRequestContext } from "@/core/studio/types/runtime";

const DEFAULT_RC: RuntimeRequestContext = {
  modelName: "gpt-4o",
  mode: "pro",
  reasoningEffort: "medium",
  thinkingEnabled: true,
  planMode: false,
  subagentEnabled: false,
};

export function useChatSession(params: {
  ownerType: "job" | "document";
  ownerId: string;
  autoCreate?: boolean;
  requestContextOverride?: Partial<RuntimeRequestContext>;
}) {
  const { requestContextOverride } = params;
  const queryClient = useQueryClient();

  const runtime = useRuntimeSession({
    ownerType: params.ownerType,
    ownerId: params.ownerId,
    autoCreate: params.autoCreate ?? true,
    requestContextOverride,
  });

  const ensureSessionAndRun = useCallback(
    async (message: string, context?: Partial<RuntimeRequestContext>) => {
      // 1. 确保 Session 存在
      const session = await runtime.ensureSession();
      const sid = session?.sessionId ?? runtime.sessionId;
      if (!sid) {
        throw new Error("无法获取或创建 Runtime Session");
      }

      // 2. 合并 requestContext
      const rc: RuntimeRequestContext = {
        ...DEFAULT_RC,
        ...requestContextOverride,
        ...context,
      };

      // 3. 启动 Run
      try {
        await startRuntimeRun(sid, {
          message,
          requestContext: rc,
        });
        void queryClient.invalidateQueries({
          queryKey: ["article-studio", "runtime-session", sid],
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "启动运行失败");
        throw e;
      }
    },
    [runtime, requestContextOverride, queryClient],
  );

  return {
    session: runtime.session,
    sessionId: runtime.sessionId,
    isLoading: runtime.isLoading,
    error: runtime.error,
    ensureSessionAndRun,
    refetchSession: runtime.refetchSession,
  };
}
