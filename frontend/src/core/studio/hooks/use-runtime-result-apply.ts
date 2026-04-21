/**
 * Latest runtime result + apply to document
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyRuntimeResultToDocument,
  getLatestRuntimeResult,
} from "../api/runtime-results";
import type { ApplyRuntimeResultPayload } from "../types/runtime";

export function useLatestRuntimeResult(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["article-studio", "runtime-latest-result", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      try {
        return await getLatestRuntimeResult(sessionId);
      } catch {
        return null;
      }
    },
    enabled: !!sessionId,
    refetchInterval: 5000,
  });
}

export function useApplyRuntimeResult(documentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { resultId: string; payload: ApplyRuntimeResultPayload }) => {
      if (!documentId) {
        return Promise.reject(new Error("no document"));
      }
      return applyRuntimeResultToDocument(documentId, vars.resultId, vars.payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["article-studio", "documents", documentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["article-studio", "runtime-latest-result"],
      });
    },
  });
}
