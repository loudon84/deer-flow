/**
 * Article Create Form Component
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PenTool, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates, useTemplate, useTemplateVersions, useCreateJob } from "@/core/studio";
import { toast } from "sonner";

export function ArticleCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams.get("templateId");

  const { data: templates } = useTemplates();
  const createJobMutation = useCreateJob();

  // 只显示 active 状态的模板
  const activeTemplates = templates?.filter(template => template.status === 'active') || [];

  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templateIdFromQuery || "",
  );
  const [modelName, setModelName] = useState("");
  const [generationMode, setGenerationMode] = useState("");
  const [systemPromptOverride, setSystemPromptOverride] = useState("");
  const [userPromptOverride, setUserPromptOverride] = useState("");
  const [inputData, setInputData] = useState<Record<string, string>>({});

  const { data: selectedTemplate } = useTemplate(selectedTemplateId);
  const { data: templateVersions } = useTemplateVersions(selectedTemplateId);

  // Get the latest version (first in the list)
  const latestVersion = templateVersions?.[0];

  // Initialize form when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setModelName(selectedTemplate.default_model_name);
      setGenerationMode(selectedTemplate.default_generation_mode);
    }
  }, [selectedTemplate]);

  // Load prompts from latest version when available
  useEffect(() => {
    if (latestVersion) {
      setSystemPromptOverride(latestVersion.system_prompt || "");
      setUserPromptOverride(latestVersion.user_prompt_template || "");
    }
  }, [latestVersion]);

  // 从 input_schema 中提取字段名
  const inputSchemaFields = latestVersion?.input_schema?.properties 
    ? Object.keys(latestVersion.input_schema.properties)
    : [];

  // 处理 userPromptOverride 中的模板变量替换
  const processUserPrompt = (prompt: string, data: Record<string, string>) => {
    let processed = prompt;
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      // 使用简单的字符串替换，避免正则表达式转义问题
      processed = processed.split(placeholder).join(value);
    });
    return processed;
  };

  const handleCreate = async () => {
    if (!selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }

    try {
      const result = await createJobMutation.mutateAsync({
        template_id: selectedTemplateId,
        input_data: inputData,
        model_name: modelName || undefined,
        generation_mode: generationMode || undefined,
        system_prompt_override: systemPromptOverride || undefined,
        user_prompt_override: userPromptOverride ? processUserPrompt(userPromptOverride, inputData) : undefined,
      });
      toast.success("Job created successfully");
      router.push(`/workspace/studio/jobs/${result.id}`);
    } catch (error) {
      toast.error("Failed to create job");
    }
  };

  if (!templates) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (activeTemplates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>
            No active templates available. Please activate a template first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Select a template and provide input data to generate an article
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Template</label>
          <Select
            value={selectedTemplateId}
            onValueChange={setSelectedTemplateId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {activeTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name} (v{template.current_version})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate && (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Model Name
              </label>
              <Input
                value={modelName}
                readOnly                
                placeholder={selectedTemplate.default_model_name}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                System Prompt
              </label>
              <Textarea
                value={systemPromptOverride}
                readOnly
                placeholder={latestVersion?.system_prompt || "No system prompt defined"}
                rows={3}
                className="bg-muted cursor-not-allowed"
              />
              {latestVersion?.system_prompt && (
                <p className="text-muted-foreground text-xs mt-1">
                  From template version {latestVersion.version} (read-only)
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                User Prompt Override (Optional)
              </label>
              <Textarea
                value={userPromptOverride}
                onChange={(e) => setUserPromptOverride(e.target.value)}
                placeholder={latestVersion?.user_prompt_template || "Override the default user prompt template"}
                rows={3}
                className="font-mono text-sm"
              />
              {latestVersion?.user_prompt_template && (
                <p className="text-muted-foreground text-xs mt-1">
                  Default from template version {latestVersion.version}
                </p>
              )}
            </div>
          </>
        )}

        {inputSchemaFields.length > 0 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium">Input Data</label>
            {inputSchemaFields.map((field) => (
              <div key={field} className="flex gap-2 items-center">
                <label className="text-sm font-medium min-w-[120px]">{field}</label>
                <Input
                  value={inputData[field] || ""}
                  onChange={(e) => setInputData({ ...inputData, [field]: e.target.value })}
                  placeholder={`Enter value for ${field}`}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleCreate}
          disabled={createJobMutation.isPending || !selectedTemplateId}
        >
          {createJobMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <PenTool className="mr-2 h-4 w-4" />
              Create
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
