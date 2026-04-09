/**
 * Document Editor Component
 */

"use client";

import { useState } from "react";
import { RefreshCw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocument, useUpdateDocument } from "@/core/studio";
import { toast } from "sonner";

interface DocumentEditorProps {
  documentId: string;
}

export function DocumentEditor({ documentId }: DocumentEditorProps) {
  const { data: document, isLoading, error, refetch } = useDocument(documentId);
  const updateMutation = useUpdateDocument(documentId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Initialize form when document loads
  if (document && !isEditing) {
    setTitle(document.title);
    setContent(document.content_markdown);
    setSummary(document.summary || "");
    setIsEditing(true);
  }

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        title,
        content_markdown: content,
        summary: summary || undefined,
      });
      toast.success("Document saved");
    } catch (error) {
      toast.error("Failed to save document");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Failed to load document</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Edit Document</span>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            size="sm"
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Content</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Document content (Markdown)"
            rows={15}
            className="font-mono text-sm"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Summary</label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Document summary"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
