/**
 * Approval Panel Component
 */

"use client";

import { useState } from "react";
import { Check, X, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useDocument,
  useSubmitApproval,
  useApproveDocument,
  useRejectDocument,
} from "@/core/studio";
import { toast } from "sonner";

interface ApprovalPanelProps {
  documentId: string;
}

export function ApprovalPanel({ documentId }: ApprovalPanelProps) {
  const { data: document } = useDocument(documentId);
  const submitMutation = useSubmitApproval();
  const approveMutation = useApproveDocument();
  const rejectMutation = useRejectDocument();

  const [comment, setComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");

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
    try {
      await approveMutation.mutateAsync({
        documentId,
        payload: { comment: comment || undefined },
      });
      toast.success("Document approved");
      setComment("");
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
            <Button
              onClick={handleSubmitApproval}
              disabled={submitMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit for Approval
            </Button>
          </div>
        )}

        {document.approval_status === "pending_approval" && (
          <div className="space-y-4">
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
