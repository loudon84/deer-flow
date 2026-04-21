/**
 * Runtime HITL (resume) API
 */

import type {
  ResumeRuntimeSessionPayload,
  ResumeRuntimeSessionResponse,
} from "../types/runtime";

import { articleStudioClient } from "./client";

export function resumeRuntimeSession(
  sessionId: string,
  payload: ResumeRuntimeSessionPayload,
) {
  return articleStudioClient.post<ResumeRuntimeSessionResponse>(
    `/api/v1/runtime/sessions/${encodeURIComponent(sessionId)}/resume`,
    {
      actionType: payload.actionType,
      resumeValue: payload.resumeValue,
      comment: payload.comment,
    },
  );
}
