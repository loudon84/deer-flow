/**
 * Template Edit Form Component
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplate, useTemplateVersions, useUpdateTemplate, useCreateTemplateVersion } from "@/core/studio";
import { loadModels } from "@/core/models/api";
import type { Model } from "@/core/models/types";
import { toast } from "sonner";

interface TemplateEditFormProps {
  templateId: string;
}

export function TemplateEditForm({ templateId }: TemplateEditFormProps) {
  const router = useRouter();
  const { data: template, isLoading: templateLoading } = useTemplate(templateId);
  const { data: versions } = useTemplateVersions(templateId);
  const updateTemplateMutation = useUpdateTemplate();
  const createVersionMutation = useCreateTemplateVersion();

  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [tags, setTags] = useState("");
  
  // Version fields
  const [defaultModelName, setDefaultModelName] = useState("");
  const [defaultGenerationMode, setDefaultGenerationMode] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [schema, setSchema] = useState('{\n  "type": "object",\n  "properties": {}\n}');

  // Load available models
  useEffect(() => {
    async function fetchModels() {
      try {
        const loadedModels = await loadModels();
        setModels(loadedModels);
      } catch (error) {
        console.error("Failed to load models:", error);
        toast.error("Failed to load available models");
      } finally {
        setModelsLoading(false);
      }
    }
    fetchModels();
  }, []);

  // Load template data
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setCategory(template.category);
      setStatus(template.status);
      setTags(template.tags.join(", "));
    }
  }, [template]);

  // Load latest version data
  useEffect(() => {
    if (versions && versions.length > 0) {
      const latestVersion = versions[0];
      setDefaultModelName(latestVersion.default_model_name);
      setDefaultGenerationMode(latestVersion.default_generation_mode);
      setReasoningEffort(latestVersion.reasoning_effort || "");
      setSystemPrompt(latestVersion.system_prompt || "");
      setUserPromptTemplate(latestVersion.user_prompt_template);
      
      // Safely stringify schema
      try {
        const schemaStr = latestVersion.input_schema 
          ? JSON.stringify(latestVersion.input_schema, null, 2)
          : '{\n  "type": "object",\n  "properties": {}\n}';
        setSchema(schemaStr);
      } catch (error) {
        console.error("Failed to stringify schema:", error);
        setSchema('{\n  "type": "object",\n  "properties": {}\n}');
      }
    }
  }, [versions]);

  // Get selected model info
  const selectedModel = models.find(m => m.name === defaultModelName);
  const supportsReasoningEffort = selectedModel?.supports_reasoning_effort ?? false;

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!category.trim()) {
      toast.error("Category is required");
      return;
    }
    if (!defaultModelName.trim()) {
      toast.error("Model is required");
      return;
    }
    if (!userPromptTemplate.trim()) {
      toast.error("User prompt template is required");
      return;
    }

    let parsedSchema;
    try {
      parsedSchema = JSON.parse(schema);
    } catch (error) {
      toast.error("Invalid JSON in schema. Please check the format.");
      return;
    }

    try {
      // Update template basic info
      await updateTemplateMutation.mutateAsync({
        templateId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim(),
          status,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        },
      });

      // Create new version
      await createVersionMutation.mutateAsync({
        templateId,
        data: {
          input_schema: parsedSchema,
          system_prompt: systemPrompt.trim() || undefined,
          user_prompt_template: userPromptTemplate.trim() || "Write an article about: {{title}}",
          default_model_name: defaultModelName.trim(),
          default_generation_mode: defaultGenerationMode,
          reasoning_effort: reasoningEffort || undefined,
        },
      });

      toast.success("Template updated successfully");
      router.push(`/workspace/studio/templates/${templateId}`);
    } catch (error) {
      toast.error("Failed to update template");
    }
  };

  if (templateLoading) {
    return (
      <Card>
        <CardHeader>
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading template...</p>
        </CardContent>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Template not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Information</CardTitle>
        <CardDescription>
          Update the template information and configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Article Template"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={template.code}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-muted-foreground text-xs">
              Code cannot be changed
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this template is for..."
            rows={3}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="blog, news, tutorial..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="ai, technology, tutorial"
          />
        </div>

        {/* Model Configuration */}
        <div className="border-t pt-6">
          <h3 className="mb-4 text-lg font-semibold">Model Configuration</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modelName">Model *</Label>
              <Select 
                value={defaultModelName} 
                onValueChange={setDefaultModelName}
                disabled={modelsLoading}
              >
                <SelectTrigger id="modelName">
                  {modelsLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading models...</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Select a model" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.name} value={model.name}>
                      <div className="flex flex-col">
                        <span>{model.display_name}</span>
                        {model.description && (
                          <span className="text-muted-foreground text-xs">
                            {model.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModel && (
                <p className="text-muted-foreground text-sm">
                  {selectedModel.supports_thinking && "✓ Supports thinking"}
                  {selectedModel.supports_thinking && selectedModel.supports_reasoning_effort && " • "}
                  {selectedModel.supports_reasoning_effort && "✓ Supports reasoning effort"}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="generationMode">Generation Mode</Label>
              <Select value={defaultGenerationMode} onValueChange={setDefaultGenerationMode}>
                <SelectTrigger id="generationMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_pass">Single Pass</SelectItem>
                  <SelectItem value="outline_then_write">Outline Then Write</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reasoning Effort - Only show if model supports it */}
          {supportsReasoningEffort && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="reasoningEffort">Reasoning Effort</Label>
              <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                <SelectTrigger id="reasoningEffort">
                  <SelectValue placeholder="Select reasoning effort level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Quick responses</SelectItem>
                  <SelectItem value="medium">Medium - Balanced</SelectItem>
                  <SelectItem value="high">High - Deep reasoning</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-sm">
                Controls how much effort the model puts into reasoning. Higher effort = better quality but slower.
              </p>
            </div>
          )}
        </div>

        {/* Prompt Configuration */}
        <div className="border-t pt-6">
          <h3 className="mb-4 text-lg font-semibold">Prompt Configuration</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a professional article writer..."
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="userPrompt">User Prompt Template</Label>
              <Textarea
                id="userPrompt"
                value={userPromptTemplate}
                onChange={(e) => setUserPromptTemplate(e.target.value)}
                placeholder="Write an article about: {{title}}"
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-muted-foreground text-sm">
                Use {"{{variable}}"} syntax to reference input variables
              </p>
            </div>
          </div>
        </div>

        {/* Input Schema */}
        <div className="border-t pt-6">
          <h3 className="mb-4 text-lg font-semibold">Input Schema</h3>
          
          <div className="space-y-2">
            <Label htmlFor="schema">JSON Schema</Label>
            <Textarea
              id="schema"
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-sm">
              Define the input parameters for this template using JSON Schema
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 border-t pt-6">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTemplateMutation.isPending || createVersionMutation.isPending}
          >
            {(updateTemplateMutation.isPending || createVersionMutation.isPending) ? (
              <>
                <Save className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
