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
import { useTemplates, useTemplate, useCreateJob } from "@/core/studio";
import { toast } from "sonner";

export function ArticleCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams.get("templateId");

  const { data: templates } = useTemplates();
  const createJobMutation = useCreateJob();

  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templateIdFromQuery || "",
  );
  const [modelName, setModelName] = useState("");
  const [generationMode, setGenerationMode] = useState("");
  const [systemPromptOverride, setSystemPromptOverride] = useState("");
  const [userPromptOverride, setUserPromptOverride] = useState("");
  const [inputData, setInputData] = useState("{}");

  const { data: selectedTemplate } = useTemplate(selectedTemplateId);

  // Initialize form when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setModelName(selectedTemplate.default_model_name);
      setGenerationMode(selectedTemplate.default_generation_mode);
    }
  }, [selectedTemplate]);

  const handleCreate = async () => {
    if (!selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }

    let parsedInputData: Record<string, unknown>;
    try {
      parsedInputData = JSON.parse(inputData);
    } catch {
      toast.error("Invalid JSON in input data");
      return;
    }

    try {
      const result = await createJobMutation.mutateAsync({
        template_id: selectedTemplateId,
        input_data: parsedInputData,
        model_name: modelName || undefined,
        generation_mode: generationMode || undefined,
        system_prompt_override: systemPromptOverride || undefined,
        user_prompt_override: userPromptOverride || undefined,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Article</CardTitle>
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
              {templates.map((template) => (
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
                onChange={(e) => setModelName(e.target.value)}
                placeholder={selectedTemplate.default_model_name}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Generation Mode
              </label>
              <Input
                value={generationMode}
                onChange={(e) => setGenerationMode(e.target.value)}
                placeholder={selectedTemplate.default_generation_mode}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                System Prompt Override (Optional)
              </label>
              <Textarea
                value={systemPromptOverride}
                onChange={(e) => setSystemPromptOverride(e.target.value)}
                placeholder="Override the default system prompt"
                rows={3}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                User Prompt Override (Optional)
              </label>
              <Textarea
                value={userPromptOverride}
                onChange={(e) => setUserPromptOverride(e.target.value)}
                placeholder="Override the default user prompt template"
                rows={3}
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium">Input Data</label>
          <Textarea
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            placeholder='{"key": "value"}'
            rows={5}
            className="font-mono text-sm"
          />
        </div>

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
              Create Article
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
