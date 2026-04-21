/**
 * Template List Component
 */

"use client";

import { useState } from "react";
import { Layers, RefreshCw } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates, useUpdateTemplate } from "@/core/studio";
import { toast } from "sonner";

export function TemplateList() {
  const { data: templates, isLoading, error, refetch } = useTemplates();
  const updateTemplateMutation = useUpdateTemplate();
  
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string;
    name: string;
    status: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState("");

  const handleOpenStatusDialog = (template: {
    id: string;
    name: string;
    status: string;
  }) => {
    setSelectedTemplate(template);
    setNewStatus(template.status);
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedTemplate || newStatus === selectedTemplate.status) {
      setStatusDialogOpen(false);
      return;
    }

    try {
      await updateTemplateMutation.mutateAsync({
        templateId: selectedTemplate.id,
        data: { status: newStatus },
      });
      toast.success("Template status updated successfully");
      setStatusDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update template status");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Failed to load templates</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Layers className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground">No templates found</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[100px]">Version</TableHead>
              <TableHead className="w-[150px]">Category</TableHead>
              <TableHead className="w-[150px]">Model</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[150px]">Updated At</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/workspace/studio/templates/${template.id}`}
                    className="hover:underline"
                  >
                    {template.name}
                  </Link>
                </TableCell>
                <TableCell>v{template.current_version}</TableCell>
                <TableCell>{template.category}</TableCell>
                <TableCell>{template.default_model_name || "-"}</TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {template.description || "-"}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      template.status === "active"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : template.status === "draft"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    }`}
                  >
                    {template.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {template.updated_at
                    ? new Date(template.updated_at).toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleOpenStatusDialog({
                        id: template.id,
                        name: template.name,
                        status: template.status,
                      })
                    }
                  >
                    Change Status
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Template Status</DialogTitle>
            <DialogDescription>
              Update the status for template: {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={updateTemplateMutation.isPending}
            >
              {updateTemplateMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
