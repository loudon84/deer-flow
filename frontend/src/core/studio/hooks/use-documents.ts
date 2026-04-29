/**
 * Documents React Query Hooks
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDocuments,
  getDocument,
  updateDocument,
  submitApproval,
  approveDocument,
  rejectDocument,
  getRagflowStatus,
  retryRagflow,
  listRagflowDatasets,
} from "../api/documents";
import type {
  UpdateDocumentPayload,
  SubmitApprovalPayload,
  ApproveDocumentPayload,
  RejectDocumentPayload,
} from "../types";

export function useDocuments() {
  return useQuery({
    queryKey: ["article-studio", "documents"],
    queryFn: listDocuments,
  });
}

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: ["article-studio", "documents", documentId],
    queryFn: () => getDocument(documentId),
    enabled: !!documentId,
  });
}

export function useUpdateDocument(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateDocumentPayload) =>
      updateDocument(documentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["article-studio", "documents", documentId],
      });
    },
  });
}

export function useSubmitApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      payload,
    }: {
      documentId: string;
      payload?: SubmitApprovalPayload;
    }) => submitApproval(documentId, payload),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({
        queryKey: ["article-studio", "documents", documentId],
      });
    },
  });
}

export function useApproveDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      payload,
    }: {
      documentId: string;
      payload: ApproveDocumentPayload;
    }) => approveDocument(documentId, payload),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({
        queryKey: ["article-studio", "documents", documentId],
      });
    },
  });
}

export function useRejectDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      payload,
    }: {
      documentId: string;
      payload: RejectDocumentPayload;
    }) => rejectDocument(documentId, payload),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({
        queryKey: ["article-studio", "documents", documentId],
      });
    },
  });
}

export function useRagflowStatus(documentId: string) {
  return useQuery({
    queryKey: ["article-studio", "documents", documentId, "ragflow-status"],
    queryFn: () => getRagflowStatus(documentId),
    enabled: !!documentId,
  });
}

export function useRetryRagflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => retryRagflow(documentId),
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({
        queryKey: ["article-studio", "documents", documentId, "ragflow-status"],
      });
    },
  });
}

export function useRagflowDatasets() {
  return useQuery({
    queryKey: ["article-studio", "ragflow-datasets"],
    queryFn: listRagflowDatasets,
  });
}
