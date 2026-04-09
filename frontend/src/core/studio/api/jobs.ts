/**
 * Jobs API
 */

import { articleStudioClient } from "./client";
import type { JobSummary, JobDetail, CreateJobPayload } from "../types";

export function listJobs() {
  return articleStudioClient.get<JobSummary[]>(
    "/api/article-studio/jobs",
  );
}

export function createJob(payload: CreateJobPayload) {
  return articleStudioClient.post<JobDetail>(
    "/api/article-studio/jobs",
    payload,
  );
}

export function getJob(jobId: string) {
  return articleStudioClient.get<JobDetail>(
    `/api/article-studio/jobs/${jobId}`,
  );
}

export function retryJob(jobId: string) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/article-studio/jobs/${jobId}/retry`,
  );
}

export function cancelJob(jobId: string) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/article-studio/jobs/${jobId}/cancel`,
  );
}
