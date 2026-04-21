/**
 * Runtime Facade types (align with backend DTOs / PRD)
 */

export type RuntimeOwnerType = "job" | "document";

export type RuntimeSessionStatus =
  | "idle"
  | "streaming"
  | "waiting_human"
  | "completed"
  | "failed"
  | "cancelled";

export type RuntimeEventType =
  | "run_start"
  | "message_delta"
  | "message_final"
  | "tool_call"
  | "tool_result"
  | "value_snapshot"
  | "custom_event"
  | "subgraph_event"
  | "interrupt"
  | "resume"
  | "run_end"
  | "error"
  | "result_materialized"
  | "document_persisted";

export type RuntimeEventSource =
  | "assistant"
  | "tool"
  | "system"
  | "subgraph"
  | "user";

export interface RuntimeInterrupt {
  kind: "approval" | "clarification" | "input" | "unknown" | string;
  prompt: string;
  raw: Record<string, unknown>;
}

export interface RuntimeSummary {
  latestAssistantText?: string | null;
  latestResultType?: string | null;
  latestResultId?: string | null;
  lastEventSeq: number;
}

export interface RuntimeSession {
  sessionId: string;
  ownerType: RuntimeOwnerType;
  ownerId: string;
  threadId: string;
  status: RuntimeSessionStatus;
  currentInterrupt?: RuntimeInterrupt | null;
  summary: RuntimeSummary;
}

export interface RuntimeEventDisplay {
  title: string;
  content?: string | null;
  severity: "info" | "success" | "warning" | "error" | string;
}

export interface RuntimeEvent {
  eventId: string;
  seq: number;
  eventType: RuntimeEventType | string;
  source: RuntimeEventSource;
  display: RuntimeEventDisplay;
  createdAt: string;
}

export interface RuntimeRequestContext {
  modelName: string;
  mode: "basic" | "pro";
  reasoningEffort?: "low" | "medium" | "high";
  thinkingEnabled?: boolean;
  planMode?: boolean;
  subagentEnabled?: boolean;
}

export interface CreateRuntimeSessionPayload {
  ownerType: RuntimeOwnerType;
  ownerId: string;
  runtimeProvider?: "deerflow";
  assistantId?: string;
  requestContext: RuntimeRequestContext;
}

export interface CreateRuntimeSessionResponse {
  sessionId: string;
  threadId: string;
  status: string;
}

export interface StartRuntimeRunPayload {
  message: string;
  requestContext?: Partial<RuntimeRequestContext>;
}

export interface StartRuntimeRunResponse {
  sessionId: string;
  accepted: boolean;
  status: string;
}

export type ResumeActionType =
  | "approve"
  | "reject"
  | "revise"
  | "custom_resume";

export interface ResumeRuntimeSessionPayload {
  actionType: ResumeActionType;
  resumeValue: Record<string, unknown>;
  comment?: string | null;
}

export interface ResumeRuntimeSessionResponse {
  sessionId: string;
  accepted: boolean;
  status: string;
}

export interface RuntimeEventListResponse {
  items: RuntimeEvent[];
  nextCursor: number | null;
}

/** SSE stream payload (subset of list item) */
export interface RuntimeEventStreamPayload {
  sessionId: string;
  seq: number;
  eventType: string;
  eventId: string;
  display?: RuntimeEventDisplay | null;
  createdAt: string;
}

export interface LatestRuntimeResult {
  resultId: string;
  resultType: string;
  title?: string | null;
  content?: string | null;
  createdAt?: string | null;
}

export type ApplyMode = "replace" | "append" | "new_version";

export interface ApplyRuntimeResultPayload {
  applyMode: ApplyMode;
}

export interface ApplyRuntimeResultResponse {
  documentId: string;
  applied: boolean;
  applyMode: string;
  newVersion: number;
}

export interface RuntimeHistoryResponse {
  sessionId: string;
  threadId: string;
  messages: unknown[];
  latestValues: Record<string, unknown>;
  currentInterrupt: unknown;
}
