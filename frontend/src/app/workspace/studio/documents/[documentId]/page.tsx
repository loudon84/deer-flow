/**
 * Document Detail Page
 */

"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Database, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DocumentEditor,
  ApprovalPanel,
  RAGFlowStatusCard,
} from "@/components/workspace/studio";
import { toast } from "sonner";

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

  return <DocumentDetailClient documentId={documentId} />;
}

function DocumentDetailClient({ documentId }: { documentId: string }) {
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [ragflowDialogOpen, setRagflowDialogOpen] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(documentId);
      toast.success("Document ID copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/workspace/studio/documents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Document Details</h1>            
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setApprovalDialogOpen(true)}
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            Approval
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRagflowDialogOpen(true)}
          >
            <Database className="mr-1.5 h-4 w-4" />
            RAGFlow
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <DocumentEditor documentId={documentId} />
      </div>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approval</DialogTitle>
          </DialogHeader>
          <ApprovalPanel documentId={documentId} />
        </DialogContent>
      </Dialog>

      {/* RAGFlow Dialog */}
      <Dialog open={ragflowDialogOpen} onOpenChange={setRagflowDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>RAGFlow Status</DialogTitle>
          </DialogHeader>
          <RAGFlowStatusCard documentId={documentId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
