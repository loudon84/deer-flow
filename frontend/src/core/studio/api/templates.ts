/**
 * Templates API
 */

import { articleStudioClient } from "./client";
import type { TemplateSummary, TemplateDetail, TemplateVersion } from "../types";

export function listTemplates() {
  return articleStudioClient.get<TemplateSummary[]>(
    "/api/v1/templates",
  );
}

export function getTemplate(templateId: string) {
  return articleStudioClient.get<TemplateDetail>(
    `/api/v1/templates/${templateId}`,
  );
}

export function createTemplate(payload: {
  name: string;
  code: string;
  description?: string;
  category: string;
  status?: string;
  default_model_name: string;
  default_generation_mode: string;
  tags?: string[];
  system_prompt?: string;
  user_prompt_template: string;
  input_schema: Record<string, unknown>;
}) {
  return articleStudioClient.post<{ id: string }>(
    "/api/v1/templates",
    payload,
  );
}

export function getTemplateVersions(templateId: string) {
  return articleStudioClient.get<TemplateVersion[]>(
    `/api/v1/templates/${templateId}/versions`,
  );
}

export function createTemplateVersion(
  templateId: string,
  payload: Record<string, unknown>,
) {
  return articleStudioClient.post<{ id: string; version: number }>(
    `/api/v1/templates/${templateId}/versions`,
    payload,
  );
}

export function updateTemplate(
  templateId: string,
  payload: Record<string, unknown>,
) {
  return articleStudioClient.put<{ ok: boolean }>(
    `/api/v1/templates/${templateId}`,
    payload,
  );
}
