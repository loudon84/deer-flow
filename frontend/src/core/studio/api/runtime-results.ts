/**
 * Runtime results API
 */

import type {
  ApplyRuntimeResultPayload,
  ApplyRuntimeResultResponse,
  LatestRuntimeResult,
} from "../types/runtime";

import { articleStudioClient } from "./client";

export function getLatestRuntimeResult(sessionId: string) {
  return articleStudioClient.get<LatestRuntimeResult>(
    `/api/v1/runtime/sessions/${encodeURIComponent(sessionId)}/results/latest`,
  );
}

export function applyRuntimeResultToDocument(
  documentId: string,
  resultId: string,
  payload: ApplyRuntimeResultPayload,
) {
  return articleStudioClient.post<ApplyRuntimeResultResponse>(
    `/api/v1/documents/${encodeURIComponent(documentId)}/runtime-results/${encodeURIComponent(resultId)}/apply`,
    { applyMode: payload.applyMode },
  );
}
