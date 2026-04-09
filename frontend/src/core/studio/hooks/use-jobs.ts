/**
 * Jobs React Query Hooks
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listJobs, createJob, getJob, retryJob, cancelJob } from "../api/jobs";
import type { CreateJobPayload } from "../types";

export function useJobs() {
  return useQuery({
    queryKey: ["article-studio", "jobs"],
    queryFn: listJobs,
  });
}

export function useJob(jobId: string) {
  return useQuery({
    queryKey: ["article-studio", "jobs", jobId],
    queryFn: () => getJob(jobId),
    enabled: !!jobId,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateJobPayload) => createJob(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-studio", "jobs"] });
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => retryJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["article-studio", "jobs"] });
      queryClient.invalidateQueries({
        queryKey: ["article-studio", "jobs", jobId],
      });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => cancelJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["article-studio", "jobs"] });
      queryClient.invalidateQueries({
        queryKey: ["article-studio", "jobs", jobId],
      });
    },
  });
}
