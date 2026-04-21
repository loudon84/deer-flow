/**
 * Runtime sessions API
 */

import type {
  CreateRuntimeSessionPayload,
  CreateRuntimeSessionResponse,
  RuntimeHistoryResponse,
  RuntimeInterrupt,
  RuntimeSession,
  StartRuntimeRunPayload,
  StartRuntimeRunResponse,
} from "../types/runtime";

import { articleStudioClient } from "./client";

/** Backend detail response (camelCase JSON) */
type SessionDetailApi = {
  sessionId: string;
  ownerType: string;
  ownerId: string;
  threadId: string;
  status: string;
  currentInterrupt?: {
    kind: string;
    prompt: string;
    raw?: Record<string, unknown>;
  } | null;
  summary: {
    latestAssistantText?: string | null;
    latestResultType?: string | null;
    latestResultId?: string | null;
    lastEventSeq: number;
  };
};

function mapDetail(d: SessionDetailApi): RuntimeSession {
  return {
    sessionId: d.sessionId,
    ownerType: d.ownerType as RuntimeSession["ownerType"],
    ownerId: d.ownerId,
    threadId: d.threadId,
    status: d.status as RuntimeSession["status"],
    currentInterrupt: d.currentInterrupt
      ? ({
          kind: d.currentInterrupt.kind,
          prompt: d.currentInterrupt.prompt,
          raw: d.currentInterrupt.raw ?? {},
        } satisfies RuntimeInterrupt)
      : null,
    summary: {
      latestAssistantText: d.summary.latestAssistantText,
      latestResultType: d.summary.latestResultType,
      latestResultId: d.summary.latestResultId,
      lastEventSeq: d.summary.lastEventSeq,
    },
  };
}

export function createRuntimeSession(payload: CreateRuntimeSessionPayload) {
  return articleStudioClient.post<CreateRuntimeSessionResponse>(
    "/api/v1/runtime/sessions",
    {
      ownerType: payload.ownerType,
      ownerId: payload.ownerId,
      runtimeProvider: payload.runtimeProvider ?? "deerflow",
      assistantId: payload.assistantId ?? "lead_agent",
      requestContext: {
        modelName: payload.requestContext.modelName,
        mode: payload.requestContext.mode,
        reasoningEffort: payload.requestContext.reasoningEffort ?? "medium",
        thinkingEnabled: payload.requestContext.thinkingEnabled ?? true,
        planMode: payload.requestContext.planMode ?? false,
        subagentEnabled: payload.requestContext.subagentEnabled ?? false,
      },
    },
  );
}

export function getRuntimeSession(sessionId: string) {
  return articleStudioClient
    .get<SessionDetailApi>(`/api/v1/runtime/sessions/${sessionId}`)
    .then(mapDetail);
}

export function startRuntimeRun(sessionId: string, payload: StartRuntimeRunPayload) {
  const body: Record<string, unknown> = { message: payload.message };
  if (payload.requestContext) {
    body.requestContext = {
      ...(payload.requestContext.modelName != null && {
        modelName: payload.requestContext.modelName,
      }),
      ...(payload.requestContext.mode != null && { mode: payload.requestContext.mode }),
      ...(payload.requestContext.reasoningEffort != null && {
        reasoningEffort: payload.requestContext.reasoningEffort,
      }),
      ...(payload.requestContext.thinkingEnabled != null && {
        thinkingEnabled: payload.requestContext.thinkingEnabled,
      }),
      ...(payload.requestContext.planMode != null && {
        planMode: payload.requestContext.planMode,
      }),
      ...(payload.requestContext.subagentEnabled != null && {
        subagentEnabled: payload.requestContext.subagentEnabled,
      }),
    };
  }
  return articleStudioClient.post<StartRuntimeRunResponse>(
    `/api/v1/runtime/sessions/${sessionId}/runs`,
    body,
  );
}

export function getRuntimeHistory(sessionId: string) {
  return articleStudioClient.get<RuntimeHistoryResponse>(
    `/api/v1/runtime/sessions/${sessionId}/history`,
  );
}
