/**
 * Approval Panel Component
 */

"use client";

import { useState } from "react";
import { Check, X, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useDocument,
  useSubmitApproval,
  useApproveDocument,
  useRejectDocument,
} from "@/core/studio";
import { toast } from "sonner";

type OperationType = "document" | "publish" | "read";

interface ApprovalPanelProps {
  documentId: string;
  /** 操作类型，控制用户可执行的操作 */
  operationType?: OperationType;
}

export function ApprovalPanel({ documentId, operationType = "read" }: ApprovalPanelProps) {
  const { data: document } = useDocument(documentId);
  const submitMutation = useSubmitApproval();
  const approveMutation = useApproveDocument();
  const rejectMutation = useRejectDocument();

  const [comment, setComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [knowledgebaseId, setKnowledgebaseId] = useState("");

  const handleSubmitApproval = async () => {
    try {
      await submitMutation.mutateAsync({
        documentId,
        payload: comment ? { comment } : undefined,
      });
      toast.success("Submitted for approval");
      setComment("");
    } catch (error) {
      toast.error("Failed to submit for approval");
    }
  };

  const handleApprove = async () => {
    if (!knowledgebaseId.trim()) {
      toast.error("Please provide a knowledgebase ID");
      return;
    }
    try {
      await approveMutation.mutateAsync({
        documentId,
        payload: {
          comment: comment || undefined,
          knowledgebase_id: knowledgebaseId,
        },
      });
      toast.success("Document approved");
      setComment("");
      setKnowledgebaseId("");
    } catch (error) {
      toast.error("Failed to approve document");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        documentId,
        payload: { reason: rejectReason },
      });
      toast.success("Document rejected");
      setRejectReason("");
    } catch (error) {
      toast.error("Failed to reject document");
    }
  };

  if (!document) return null;

  // 根据操作类型判断是否有权限执行操作
  const canSubmitApproval = operationType === "document";
  const canApproveOrReject = operationType === "publish";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Status:</span>
          <span className="capitalize">
            {document.approval_status.replace("_", " ")}
          </span>
        </div>

        {document.approval_status === "draft" && (
          <div className="space-y-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)"
              rows={2}
            />
            {canSubmitApproval && (
              <Button
                onClick={handleSubmitApproval}
                disabled={submitMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit for Approval
              </Button>
            )}
          </div>
        )}

        {document.approval_status === "pending_approval" && (
          <div className="space-y-4">
            {canApproveOrReject && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Knowledgebase ID <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={knowledgebaseId}
                    onChange={(e) => setKnowledgebaseId(e.target.value)}
                    placeholder="Enter RAGFlow knowledgebase ID"
                  />
                </div>

                <div className="space-y-2">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment (optional)"
                    rows={2}
                  />
                  <Button
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </div>

                <div className="space-y-2">
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (required)"
                    rows={2}
                  />
                  <Button
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                    variant="destructive"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </>
            )}
            {!canApproveOrReject && (
              <p className="text-muted-foreground text-sm">
                Waiting for approval.
              </p>
            )}
          </div>
        )}

        {document.approval_status === "approved" && (
          <p className="text-muted-foreground text-sm">
            This document has been approved.
          </p>
        )}

        {document.approval_status === "rejected" && (
          <p className="text-muted-foreground text-sm">
            This document has been rejected.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
