/**
 * Template Detail Component
 */

"use client";

import { RefreshCw, History, PenTool } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTemplate } from "@/core/studio";

interface TemplateDetailProps {
  templateId: string;
}

export function TemplateDetail({ templateId }: TemplateDetailProps) {
  const { data: template, isLoading, error, refetch } = useTemplate(templateId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Failed to load template</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{template.name}</span>
            <span className="text-muted-foreground text-sm font-normal">
              v{template.current_version}
            </span>
          </CardTitle>
          <CardDescription>{template.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-sm">Category</p>
              <p className="font-medium">{template.category}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Status</p>
              <p className="font-medium">{template.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Default Model</p>
              <p className="font-medium">{template.default_model_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Generation Mode</p>
              <p className="font-medium">{template.default_generation_mode}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="bg-secondary text-secondary-foreground rounded-md px-2 py-1 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/workspace/studio/create?templateId=${template.id}`}>
                <PenTool className="mr-2 h-4 w-4" />
                Create Article
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/workspace/studio/templates/${template.id}/versions`}
              >
                <History className="mr-2 h-4 w-4" />
                View Versions
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
