/**
 * Create Template Form Component
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

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
import { useCreateTemplate } from "@/core/studio";
import { loadModels } from "@/core/models/api";
import type { Model } from "@/core/models/types";
import { toast } from "sonner";

export function CreateTemplateForm() {
  const router = useRouter();
  const createMutation = useCreateTemplate();

  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  const [name, setName] = useState("");
  const [code] = useState(() => uuidv4()); // Auto-generated UUID, read-only
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("draft");
  const [defaultModelName, setDefaultModelName] = useState("");
  const [defaultGenerationMode, setDefaultGenerationMode] = useState("single_pass");
  const [reasoningEffort, setReasoningEffort] = useState<string>("");
  const [tags, setTags] = useState("");
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

  // Get selected model info
  const selectedModel = models.find(m => m.name === defaultModelName);
  const supportsReasoningEffort = selectedModel?.supports_reasoning_effort ?? false;

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!code.trim()) {
      toast.error("Template code is required");
      return;
    }
    if (!category.trim()) {
      toast.error("Category is required");
      return;
    }

    let parsedSchema;
    try {
      parsedSchema = JSON.parse(schema);
    } catch {
      toast.error("Invalid JSON in schema");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || undefined,
        category: category.trim(),
        status,
        default_model_name: defaultModelName.trim() || undefined,
        default_generation_mode: defaultGenerationMode,
        reasoning_effort: reasoningEffort || undefined,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        system_prompt: systemPrompt.trim() || undefined,
        user_prompt_template: userPromptTemplate.trim() || "Write an article about: {{title}}",
        input_schema: parsedSchema,
      });
      
      toast.success("Template created successfully");
      router.push(`/workspace/studio/templates/${result.id}`);
    } catch (error) {
      toast.error("Failed to create template");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Information</CardTitle>
        <CardDescription>
          Define the basic information and configuration for your template
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
            <Label htmlFor="code">Code *</Label>
            <Input
              id="code"
              value={code}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-muted-foreground text-xs">
              Auto-generated unique identifier
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
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Save className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
