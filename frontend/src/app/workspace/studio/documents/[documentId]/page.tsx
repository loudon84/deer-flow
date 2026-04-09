/**
 * Document Detail Page
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DocumentEditor,
  ApprovalPanel,
  RAGFlowStatusCard,
} from "@/components/workspace/studio";

interface DocumentDetailPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

export default async function DocumentDetailPage({
  params,
}: DocumentDetailPageProps) {
  const { documentId } = await params;

  if (!documentId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workspace/studio/documents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Document Details</h1>
          <p className="text-muted-foreground">
            Edit, approve, and manage document
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DocumentEditor documentId={documentId} />
        </div>
        <div className="space-y-6">
          <ApprovalPanel documentId={documentId} />
          <RAGFlowStatusCard documentId={documentId} />
        </div>
      </div>
    </div>
  );
}
