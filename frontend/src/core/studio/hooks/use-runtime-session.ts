/**
 * Resolve runtime session for a job or document owner.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { getDocument } from "../api/documents";
import { getJob } from "../api/jobs";
import {
  createRuntimeSession,
  getRuntimeSession,
} from "../api/runtime-sessions";
import type { DocumentDetail, JobDetail } from "../types";
import type { RuntimeRequestContext, RuntimeSession } from "../types/runtime";

const DEFAULT_RC: RuntimeRequestContext = {
  modelName: "gpt-4o",
  mode: "pro",
  reasoningEffort: "medium",
  thinkingEnabled: true,
  planMode: false,
  subagentEnabled: false,
};

function buildRequestContextFromJob(job: {
  model_name?: string;
  generation_mode?: string;
}): RuntimeRequestContext {
  return {
    ...DEFAULT_RC,
    modelName: job.model_name ?? DEFAULT_RC.modelName,
    mode: job.generation_mode === "basic" ? "basic" : "pro",
  };
}

export function useRuntimeSession(params: {
  ownerType: "job" | "document";
  ownerId: string;
  autoCreate: boolean;
  /** Used when creating a new session (job model, etc.) */
  requestContextOverride?: Partial<RuntimeRequestContext>;
  /** When false, skips owner fetch and session resolution (for conditional panels). */
  enabled?: boolean;
}) {
  const { ownerType, ownerId, autoCreate, requestContextOverride, enabled = true } =
    params;
  const queryClient = useQueryClient();

  const ownerQuery = useQuery<JobDetail | DocumentDetail>({
    queryKey: ["article-studio", ownerType === "job" ? "jobs" : "documents", ownerId],
    queryFn: () =>
      ownerType === "job" ? getJob(ownerId) : getDocument(ownerId),
    enabled: enabled && !!ownerId,
  });

  const inferredSessionId = useMemo(() => {
    const d = ownerQuery.data;
    if (!d) return null;
    if (ownerType === "job") {
      return (d as JobDetail).runtime_session_id ?? null;
    }
    return (d as DocumentDetail).latest_runtime_session_id ?? null;
  }, [ownerQuery.data, ownerType]);

  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const autoCreateTriedRef = useRef(false);

  useEffect(() => {
    autoCreateTriedRef.current = false;
  }, [ownerId, ownerType]);

  const createMutation = useMutation({
    mutationFn: async () => {
      let rc: RuntimeRequestContext = { ...DEFAULT_RC, ...requestContextOverride };
      if (ownerType === "job" && ownerQuery.data) {
        rc = {
          ...buildRequestContextFromJob(ownerQuery.data as JobDetail),
          ...requestContextOverride,
        };
      }
      const res = await createRuntimeSession({
        ownerType,
        ownerId,
        requestContext: rc,
      });
      return res.sessionId;
    },
    onSuccess: (id) => {
      setCreatedSessionId(id);
      void queryClient.invalidateQueries({
        queryKey: ["article-studio", ownerType === "job" ? "jobs" : "documents", ownerId],
      });
    },
  });

  useEffect(() => {
    if (!enabled) return;
    if (!ownerQuery.isSuccess || !ownerQuery.data) return;
    if (inferredSessionId) return;
    if (!autoCreate) return;
    if (createdSessionId) return;
    if (autoCreateTriedRef.current) return;
    if (createMutation.isPending) return;
    autoCreateTriedRef.current = true;
    createMutation.mutate();
  }, [
    enabled,
    ownerQuery.isSuccess,
    ownerQuery.data,
    inferredSessionId,
    autoCreate,
    createdSessionId,
    createMutation.isPending,
    createMutation,
  ]);

  const sessionId = inferredSessionId ?? createdSessionId;

  const sessionQuery = useQuery({
    queryKey: ["article-studio", "runtime-session", sessionId],
    queryFn: () => {
      if (!sessionId) {
        throw new Error("sessionId required");
      }
      return getRuntimeSession(sessionId);
    },
    enabled: enabled && !!sessionId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "streaming" || s === "waiting_human") return 3000;
      return false;
    },
  });

  const session: RuntimeSession | null = sessionQuery.data ?? null;

  return {
    session,
    sessionId,
    isLoading:
      !enabled
        ? false
        : ownerQuery.isLoading ||
          (!!autoCreate && createMutation.isPending && !sessionId) ||
          (!!sessionId && sessionQuery.isLoading),
    error: ownerQuery.error ?? createMutation.error ?? sessionQuery.error,
    refetchSession: sessionQuery.refetch,
    ensureSession: async (): Promise<RuntimeSession | null> => {
      if (sessionId) {
        const r = await getRuntimeSession(sessionId);
        await queryClient.setQueryData(["article-studio", "runtime-session", sessionId], r);
        return r;
      }
      const id = await createMutation.mutateAsync();
      const r = await getRuntimeSession(id);
      await queryClient.setQueryData(["article-studio", "runtime-session", id], r);
      return r;
    },
  };
}
