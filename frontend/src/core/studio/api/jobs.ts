/**
 * Jobs API
 */

import { articleStudioClient } from "./client";
import type { JobSummary, JobDetail, CreateJobPayload } from "../types";

export function listJobs() {
  return articleStudioClient.get<JobSummary[]>(
    "/api/v1/jobs",
  );
}

export function createJob(payload: CreateJobPayload) {
  return articleStudioClient.post<JobDetail>(
    "/api/v1/jobs",
    payload,
  );
}

export function getJob(jobId: string) {
  return articleStudioClient.get<JobDetail>(
    `/api/v1/jobs/${jobId}`,
  );
}

export function retryJob(jobId: string) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/v1/jobs/${jobId}/retry`,
  );
}

export function cancelJob(jobId: string) {
  return articleStudioClient.post<{ ok: true }>(
    `/api/v1/jobs/${jobId}/cancel`,
  );
}
