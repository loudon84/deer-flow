/**
 * Documents API
 */

import { articleStudioClient } from "./client";
import type {
  DocumentDetail,
  UpdateDocumentPayload,
  SubmitApprovalPayload,
  ApproveDocumentPayload,
  RejectDocumentPayload,
  RAGFlowStatus,
} from "../types";

export function listDocuments() {
  return articleStudioClient.get<DocumentDetail[]>(
    "/api/v1/documents",
  );
}

export function getDocument(documentId: string) {
  return articleStudioClient.get<DocumentDetail>(
    `/api/v1/documents/${documentId}`,
  );
}

export function updateDocument(
  documentId: string,
  payload: UpdateDocumentPayload,
) {
  return articleStudioClient.put<{ ok: true }>(
    `/api/v1/documents/${documentId}`,
    payload,
  );
}

export function submitApproval(
  documentId: string,
  payload?: SubmitApprovalPayload,
) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/v1/documents/${documentId}/submit-approval`,
    payload ?? {},
  );
}

export function approveDocument(
  documentId: string,
  payload: ApproveDocumentPayload,
) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/v1/documents/${documentId}/approve`,
    payload,
  );
}

export function rejectDocument(
  documentId: string,
  payload: RejectDocumentPayload,
) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/v1/documents/${documentId}/reject`,
    payload,
  );
}

export function getRagflowStatus(documentId: string) {
  return articleStudioClient.get<RAGFlowStatus>(
    `/api/v1/documents/${documentId}/ragflow-status`,
  );
}

export function retryRagflow(documentId: string) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/v1/documents/${documentId}/ragflow-retry`,
  );
}
