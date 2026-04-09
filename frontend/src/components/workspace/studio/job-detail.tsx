/**
 * Job Detail Component
 */

"use client";

import { RefreshCw, FileText, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useJob, useRetryJob } from "@/core/studio";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface JobDetailProps {
  jobId: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  running: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

export function JobDetail({ jobId }: JobDetailProps) {
  const { data: job, isLoading, error, refetch } = useJob(jobId);
  const retryMutation = useRetryJob();

  const handleRetry = async () => {
    try {
      await retryMutation.mutateAsync(jobId);
      toast.success("Job retry initiated");
    } catch (error) {
      toast.error("Failed to retry job");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Failed to load job</p>
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
            <span className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${statusColors[job.status]}`}
              />
              Job {job.id.slice(0, 8)}
            </span>
            <span className="text-muted-foreground text-sm font-normal capitalize">
              {job.status}
            </span>
          </CardTitle>
          <CardDescription>
            Template: {job.template_name || job.template_id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-sm">Created</p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(job.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Updated</p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(job.updated_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          {job.last_error && (
            <div>
              <p className="mb-2 text-sm font-medium text-destructive">Error</p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                {job.last_error}
              </pre>
            </div>
          )}

          {job.input_data && (
            <div>
              <p className="mb-2 text-sm font-medium">Input Data</p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                {JSON.stringify(job.input_data, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex gap-2">
            {job.document_id && (
              <Button asChild>
                <Link
                  href={`/workspace/studio/documents/${job.document_id}`}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Document
                </Link>
              </Button>
            )}
            {job.status === "failed" && (
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={retryMutation.isPending}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
