/**
 * Templates React Query Hooks
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTemplates, getTemplate, getTemplateVersions, createTemplate, updateTemplate, createTemplateVersion } from "../api/templates";

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

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-studio", "templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: Record<string, unknown> }) =>
      updateTemplate(templateId, data),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["article-studio", "templates"] });
      queryClient.invalidateQueries({ queryKey: ["article-studio", "templates", templateId] });
    },
  });
}

export function useCreateTemplateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: Record<string, unknown> }) =>
      createTemplateVersion(templateId, data),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["article-studio", "templates", templateId] });
      queryClient.invalidateQueries({ queryKey: ["article-studio", "templates", templateId, "versions"] });
    },
  });
}
