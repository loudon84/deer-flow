/**
 * Job Detail Component
 */

"use client";

import { RefreshCw, FileText, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJob, useRetryJob } from "@/core/studio";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

interface JobDetailProps {
  jobId: string;
}

const statusColors: Record<string, string> = {
  queued: "bg-yellow-500",
  pending: "bg-yellow-500",
  running: "bg-blue-500",
  waiting_human: "bg-amber-500",
  succeeded: "bg-green-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
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

          {/* Input Parameters */}
          {(job.input_data || job.input_params) && (
            <div>
              <p className="mb-2 text-sm font-medium">Input Parameters</p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                {JSON.stringify(job.input_data || job.input_params, null, 2)}
              </pre>
            </div>
          )}

          {/* Prompt Override */}
          {job.prompt_override && (
            <div>
              <p className="mb-2 text-sm font-medium">Prompt Override</p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                {typeof job.prompt_override === 'string'
                  ? job.prompt_override
                  : JSON.stringify(job.prompt_override, null, 2)}
              </pre>
            </div>
          )}

          {/* System Prompt Override */}
          {job.system_prompt_override && (
            <div>
              <p className="mb-2 text-sm font-medium">System Prompt Override</p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                {job.system_prompt_override}
              </pre>
            </div>
          )}

          {/* User Prompt Override */}
          {job.user_prompt_override && (
            <div>
              <p className="mb-2 text-sm font-medium">User Prompt Override</p>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                {job.user_prompt_override}
              </pre>
            </div>
          )}

          {/* Tokens Usage */}
          {(job.total_prompt_tokens || job.total_completion_tokens || job.total_tokens) && (
            <div>
              <p className="mb-2 text-sm font-medium">Tokens Usage</p>
              <div className="grid grid-cols-3 gap-4 rounded-md border p-3">
                <div>
                  <p className="text-muted-foreground text-xs">Prompt Tokens</p>
                  <p className="font-medium">{job.total_prompt_tokens || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Completion Tokens</p>
                  <p className="font-medium">{job.total_completion_tokens || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total Tokens</p>
                  <p className="font-medium">{job.total_tokens || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Work Logs */}
          {job.work_logs && job.work_logs.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Work Logs</p>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[150px]">Step</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {job.work_logs.map((log, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs">
                          {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss")}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {log.step}
                        </TableCell>
                        <TableCell>
                          <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
