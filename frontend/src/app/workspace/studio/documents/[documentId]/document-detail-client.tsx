"use client";

import { ArrowLeft, CheckCircle, Database } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

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
  RuntimePanel,
} from "@/components/workspace/studio";
import type { ApplyMode } from "@/core/studio/types/runtime";

export function DocumentDetailClient({ documentId }: { documentId: string }) {
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [ragflowDialogOpen, setRagflowDialogOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);

  const onApplyRequest = useCallback(
    async (_applyMode: ApplyMode) => {
      if (!editorDirty) return true;
      return window.confirm(
        "编辑器有未保存的更改，应用 AI 结果可能覆盖与当前编辑器不一致的内容。继续？",
      );
    },
    [editorDirty],
  );

  return (
    <div className="flex size-full flex-col">
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

      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6 lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <DocumentEditor
            documentId={documentId}
            onDirtyChange={setEditorDirty}
          />
        </div>
        <aside className="border-border w-full shrink-0 lg:w-[420px] lg:border-l lg:pl-6">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            DeerFlow Runtime
          </h2>
          <RuntimePanel
            ownerType="document"
            ownerId={documentId}
            autoCreate={false}
            showSessionTabs
            mode="document"
            documentId={documentId}
            isDocumentDirty={editorDirty}
            onApplyRequest={onApplyRequest}
          />
        </aside>
      </div>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approval</DialogTitle>
          </DialogHeader>
          <ApprovalPanel documentId={documentId} />
        </DialogContent>
      </Dialog>

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
