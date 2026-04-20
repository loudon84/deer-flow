/**
 * Job List Component
 */

"use client";

import { ListTodo, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJobs } from "@/core/studio";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  queued: "bg-yellow-500",
  running: "bg-blue-500",
  succeeded: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function JobList() {
  const { data: jobs, isLoading, error, refetch } = useJobs();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Failed to load jobs</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <ListTodo className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground">No jobs found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Document</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              key={job.id}
              className="cursor-pointer hover:bg-muted/50"
            >
              <TableCell>
                <Link href={`/workspace/studio/jobs/${job.id}`}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${statusColors[job.status]}`}
                    />
                    <span className="capitalize text-sm">
                      {statusLabels[job.status]}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link 
                  href={`/workspace/studio/jobs/${job.id}`}
                  className="hover:underline"
                >
                  {job.template_name || `Job ${job.id.slice(0, 8)}`}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/workspace/studio/jobs/${job.id}`}>
                  <span className="text-muted-foreground text-sm">
                    {job.model_name || "-"}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/workspace/studio/jobs/${job.id}`}>
                  <span className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(job.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/workspace/studio/jobs/${job.id}`}>
                  {job.document_id ? (
                    <span className="text-muted-foreground text-sm">
                      {job.document_id.slice(0, 8)}...
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
