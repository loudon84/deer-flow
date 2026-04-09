/**
 * RAGFlow Status Card Component
 */

"use client";

import { Database, RotateCcw, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRagflowStatus, useRetryRagflow } from "@/core/studio";
import { toast } from "sonner";

interface RAGFlowStatusCardProps {
  documentId: string;
}

const statusColors: Record<string, string> = {
  not_indexed: "bg-gray-500",
  queued: "bg-blue-500",
  indexing: "bg-blue-500",
  indexed: "bg-green-500",
  failed: "bg-red-500",
  stale: "bg-orange-500",
};

export function RAGFlowStatusCard({ documentId }: RAGFlowStatusCardProps) {
  const { data: status, isLoading, error, refetch } = useRagflowStatus(documentId);
  const retryMutation = useRetryRagflow();

  const handleRetry = async () => {
    try {
      await retryMutation.mutateAsync(documentId);
      toast.success("RAGFlow retry initiated");
    } catch (error) {
      toast.error("Failed to retry RAGFlow indexing");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>RAGFlow Status</CardTitle>
          <CardDescription>Failed to load status</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          RAGFlow Status
        </CardTitle>
        <CardDescription>
          <span className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${statusColors[status.ragflow_status]}`}
            />
            <span className="capitalize">
              {status.ragflow_status.replace("_", " ")}
            </span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.knowledgebase_id && (
          <div>
            <p className="text-muted-foreground text-sm">Knowledge Base ID</p>
            <p className="font-mono text-sm">{status.knowledgebase_id}</p>
          </div>
        )}

        {status.ragflow_document_id && (
          <div>
            <p className="text-muted-foreground text-sm">Document ID</p>
            <p className="font-mono text-sm">{status.ragflow_document_id}</p>
          </div>
        )}

        {status.last_error && (
          <div>
            <p className="text-muted-foreground text-sm">Error</p>
            <p className="text-destructive text-sm">{status.last_error}</p>
          </div>
        )}

        {(status.ragflow_status === "failed" ||
          status.ragflow_status === "stale") && (
          <Button
            onClick={handleRetry}
            disabled={retryMutation.isPending}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry Indexing
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
