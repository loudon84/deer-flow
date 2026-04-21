/**
 * Document Editor Component
 */

"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save, Copy } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocument, useUpdateDocument } from "@/core/studio";
import { toast } from "sonner";

const BlockNoteEditorDynamic = dynamic(
  () =>
    import("@/components/ai-elements/blocknote-editor").then((mod) => ({
      default: mod.BlockNoteEditor,
    })),
  { ssr: false },
);

interface DocumentEditorProps {
  documentId: string;
  /** Fired when title/summary/正文编辑导致相对上次保存或加载有未保存变更 */
  onDirtyChange?: (dirty: boolean) => void;
}

export function DocumentEditor({ documentId, onDirtyChange }: DocumentEditorProps) {
  const { data: document, isLoading, error, refetch } = useDocument(documentId);
  const updateMutation = useUpdateDocument(documentId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [baseline, setBaseline] = useState({ title: "", summary: "" });
  const [contentDirty, setContentDirty] = useState(false);

  // Initialize form when document loads
  if (document && !isEditing) {
    setTitle(document.title);
    setContent(document.content_markdown);
    setSummary(document.summary || "");
    setIsEditing(true);
  }

  useEffect(() => {
    if (!document) return;
    setBaseline({
      title: document.title,
      summary: document.summary ?? "",
    });
    setContentDirty(false);
  }, [document?.id, document?.updated_at, document]);

  const dirty =
    title !== baseline.title ||
    summary !== baseline.summary ||
    contentDirty;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        title,
        content_markdown: content,
        summary: summary || undefined,
      });
      setBaseline({ title, summary });
      setContentDirty(false);
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

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(documentId);
      toast.success("Document ID copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-10">
      {/* Left panel - 7/10 */}
      <div className="lg:col-span-7">
        <Card>
          <CardContent>
            <div className="border-input min-h-[400px]">
              <BlockNoteEditorDynamic
                key={documentId}
                className="h-full"
                markdown={content}
                editable={true}
                showTOC={true}
                onDocumentChange={() => setContentDirty(true)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Right panel - 3/10 */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                size="sm"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>

              <div className="mt-0.5 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <code className="text-muted-foreground font-mono text-xs">
                    {documentId.slice(0, 16)}...
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={handleCopyId}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
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
              <label className="mb-2 block text-sm font-medium">Summary</label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Document summary"
                rows={6}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
