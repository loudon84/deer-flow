/**
 * Publishing List Component
 *
 * Displays documents with approval_status of "pending_approval" or "approved".
 * Table structure is identical to DocumentList.
 */

"use client";

import { FileText, RefreshCw } from "lucide-react";
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
import { useDocuments } from "@/core/studio";
import { formatDistanceToNow } from "date-fns";

const PUBLISHING_STATUSES = ["pending_approval", "approved"] as const;

const approvalStatusColors: Record<string, string> = {
  draft: "bg-gray-500",
  pending_approval: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

const ragflowStatusColors: Record<string, string> = {
  not_indexed: "bg-gray-500",
  queued: "bg-blue-500",
  indexing: "bg-blue-500",
  indexed: "bg-green-500",
  failed: "bg-red-500",
  stale: "bg-orange-500",
};

const approvalStatusLabels: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

const ragflowStatusLabels: Record<string, string> = {
  not_indexed: "Not Indexed",
  queued: "Queued",
  indexing: "Indexing",
  indexed: "Indexed",
  failed: "Failed",
  stale: "Stale",
};

function formatSafeDate(dateString: string | undefined | null): string {
  if (!dateString) {
    return "-";
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "-";
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "-";
  }
}

export function PublishingList() {
  const { data: documents, isLoading, error, refetch } = useDocuments();

  const publishingDocuments = documents?.filter((doc) =>
    (PUBLISHING_STATUSES as readonly string[]).includes(doc.approval_status),
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-[100px]">Version</TableHead>
                <TableHead className="w-[150px]">Approval Status</TableHead>
                <TableHead className="w-[150px]">RAGFlow Status</TableHead>
                <TableHead className="w-[150px]">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
        <p className="text-muted-foreground">Failed to load documents</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!publishingDocuments || publishingDocuments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <FileText className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground">No documents found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead className="w-[100px]">Version</TableHead>
            <TableHead className="w-[150px]">Approval Status</TableHead>
            <TableHead className="w-[150px]">RAGFlow Status</TableHead>
            <TableHead className="w-[150px]">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {publishingDocuments.map((doc) => (
            <TableRow
              key={doc.id}
              className="cursor-pointer hover:bg-muted/50"
            >
              <TableCell>
                <Link
                  href={`/workspace/studio/publishing/${doc.id}`}
                  className="hover:underline"
                >
                  {doc.title}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/workspace/studio/publishing/${doc.id}`}>
                  <span className="text-muted-foreground text-sm">
                    v{doc.version}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/workspace/studio/publishing/${doc.id}`}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${approvalStatusColors[doc.approval_status]}`}
                    />
                    <span className="text-sm">
                      {approvalStatusLabels[doc.approval_status]}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/workspace/studio/publishing/${doc.id}`}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${ragflowStatusColors[doc.ragflow_status]}`}
                    />
                    <span className="text-sm">
                      {ragflowStatusLabels[doc.ragflow_status]}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/workspace/studio/publishing/${doc.id}`}>
                  <span className="text-muted-foreground text-sm">
                    {formatSafeDate(doc.updated_at)}
                  </span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
