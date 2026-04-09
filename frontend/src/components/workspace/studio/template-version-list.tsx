/**
 * Template Version List Component
 */

"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTemplateVersions } from "@/core/studio";

interface TemplateVersionListProps {
  templateId: string;
}

export function TemplateVersionList({ templateId }: TemplateVersionListProps) {
  const { data: versions, isLoading, error, refetch } = useTemplateVersions(templateId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Failed to load versions</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">No versions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {versions.map((version) => (
        <Card key={version.id}>
          <CardHeader>
            <CardTitle>Version {version.version}</CardTitle>
            <CardDescription>
              Model: {version.default_model_name} | Mode:{" "}
              {version.default_generation_mode}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {version.system_prompt && (
              <div>
                <p className="mb-2 text-sm font-medium">System Prompt</p>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                  {version.system_prompt}
                </pre>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium">User Prompt Template</p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                {version.user_prompt_template}
              </pre>
            </div>

            {version.example_input && (
              <div>
                <p className="mb-2 text-sm font-medium">Example Input</p>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                  {JSON.stringify(version.example_input, null, 2)}
                </pre>
              </div>
            )}

            {version.example_output && (
              <div>
                <p className="mb-2 text-sm font-medium">Example Output</p>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                  {version.example_output}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
