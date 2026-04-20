/**
 * Template Edit Page
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TemplateEditForm } from "@/components/workspace/studio";

interface TemplateEditPageProps {
  params: Promise<{
    templateId: string;
  }>;
}

export default async function TemplateEditPage({
  params,
}: TemplateEditPageProps) {
  const { templateId } = await params;

  if (!templateId) {
    notFound();
  }

  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="flex items-center gap-4 border-b px-6 py-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workspace/studio/templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Edit Template</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Update template information and create a new version
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <TemplateEditForm templateId={templateId} />
      </div>
    </div>
  );
}
