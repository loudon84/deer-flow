/**
 * Templates API
 */

import { articleStudioClient } from "./client";
import type { TemplateSummary, TemplateDetail, TemplateVersion } from "../types";

export function listTemplates() {
  return articleStudioClient.get<TemplateSummary[]>(
    "/api/article-studio/templates",
  );
}

export function getTemplate(templateId: string) {
  return articleStudioClient.get<TemplateDetail>(
    `/api/article-studio/templates/${templateId}`,
  );
}

export function getTemplateVersions(templateId: string) {
  return articleStudioClient.get<TemplateVersion[]>(
    `/api/article-studio/templates/${templateId}/versions`,
  );
}

export function createTemplateVersion(
  templateId: string,
  payload: Record<string, unknown>,
) {
  return articleStudioClient.post<{ id: string; version: number }>(
    `/api/article-studio/templates/${templateId}/versions`,
    payload,
  );
}
