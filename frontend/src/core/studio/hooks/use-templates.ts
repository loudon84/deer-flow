/**
 * Templates React Query Hooks
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { listTemplates, getTemplate, getTemplateVersions } from "../api/templates";

export function useTemplates() {
  return useQuery({
    queryKey: ["article-studio", "templates"],
    queryFn: listTemplates,
  });
}

export function useTemplate(templateId: string) {
  return useQuery({
    queryKey: ["article-studio", "templates", templateId],
    queryFn: () => getTemplate(templateId),
    enabled: !!templateId,
  });
}

export function useTemplateVersions(templateId: string) {
  return useQuery({
    queryKey: ["article-studio", "templates", templateId, "versions"],
    queryFn: () => getTemplateVersions(templateId),
    enabled: !!templateId,
  });
}
