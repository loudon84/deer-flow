/**
 * Document List Component
 */

"use client";

import { FileText, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/core/studio";
import { formatDistanceToNow } from "date-fns";

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

export function DocumentList() {
  const { data: documents, isLoading, error, refetch } = useDocuments();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
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

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <FileText className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground">No documents found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <Link key={doc.id} href={`/workspace/studio/documents/${doc.id}`}>
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{doc.title}</span>
                <span className="text-muted-foreground text-sm font-normal">
                  v{doc.version}
                </span>
              </CardTitle>
              <CardDescription>
                Updated{" "}
                {formatDistanceToNow(new Date(doc.updated_at), {
                  addSuffix: true,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${approvalStatusColors[doc.approval_status]}`}
                  />
                  <span className="text-sm capitalize">
                    {doc.approval_status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${ragflowStatusColors[doc.ragflow_status]}`}
                  />
                  <span className="text-sm capitalize">
                    {doc.ragflow_status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
