/**
 * Article Studio Types
 * DTO types for Article Studio API
 */

export interface TemplateSummary {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
  current_version: number;
  default_model_name: string;
  default_generation_mode: string;
  reasoning_effort?: string | null;
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

export interface TemplateVersion {
  id: string;
  version: number;
  input_schema: Record<string, unknown>;
  system_prompt?: string | null;
  user_prompt_template: string;
  default_model_name: string;
  default_generation_mode: string;
  reasoning_effort?: string | null;
  example_input?: Record<string, unknown> | null;
  example_output?: string | null;
}

export interface TemplateDetail extends TemplateSummary {
  versions?: TemplateVersion[];
}

export interface WorkLog {
  step: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface JobSummary {
  id: string;
  template_id: string;
  template_name?: string;
  status:
    | "queued"
    | "running"
    | "waiting_human"
    | "succeeded"
    | "failed"
    | "cancelled";
  document_id?: string | null;
  created_at: string;
  updated_at: string;
  last_error?: string | null;
  model_name?: string;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  total_tokens?: number;
  runtime_session_id?: string | null;
  runtime_provider?: string | null;
  runtime_status?: string | null;
}

export interface JobDetail extends JobSummary {
  input_data?: Record<string, unknown>;
  input_params?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  work_logs?: WorkLog[];
  prompt_override?: string | { system?: string; user?: string };
  system_prompt_override?: string;
  user_prompt_override?: string;
}

export interface DocumentDetail {
  id: string;
  title: string;
  content_markdown: string;
  summary?: string | null;
  keywords: string[];
  approval_status: "draft" | "pending_approval" | "approved" | "rejected";
  ragflow_status:
    | "not_indexed"
    | "queued"
    | "indexing"
    | "indexed"
    | "failed"
    | "stale";
  version: number;
  created_at: string;
  updated_at: string;
  job_id?: string | null;
  runtime_session_ids?: string[] | null;
  latest_runtime_session_id?: string | null;
}

export interface CreateJobPayload {
  template_id: string;
  version?: number;
  input_data: Record<string, unknown>;
  model_name?: string;
  generation_mode?: string;
  system_prompt_override?: string;
  user_prompt_override?: string;
}

export interface UpdateDocumentPayload {
  title?: string;
  content_markdown?: string;
  summary?: string;
  keywords?: string[];
}

export interface SubmitApprovalPayload {
  comment?: string;
}

export interface ApproveDocumentPayload {
  comment?: string;
  knowledgebase_id: string;
  dataset_id?: string;
}

export interface RagflowDataset {
  id: string;
  name: string;
}

export interface RejectDocumentPayload {
  reason: string;
}

export interface RAGFlowStatus {
  document_id: string;
  ragflow_status: string;
  ragflow_document_id?: string | null;
  knowledgebase_id?: string | null;
  last_error?: string | null;
}
