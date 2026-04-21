/**
 * HITL resume mutation
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { resumeRuntimeSession } from "../api/runtime-hitl";
import type { ResumeRuntimeSessionPayload } from "../types/runtime";

export function useResumeRuntimeSession(sessionId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ResumeRuntimeSessionPayload) => {
      if (!sessionId) {
        return Promise.reject(new Error("no session"));
      }
      return resumeRuntimeSession(sessionId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["article-studio", "runtime-session", sessionId],
      });
      await queryClient.invalidateQueries({ queryKey: ["article-studio", "jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["article-studio", "documents"] });
    },
  });
}
