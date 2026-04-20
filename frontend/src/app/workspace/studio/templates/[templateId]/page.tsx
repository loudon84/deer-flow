/**
 * Template Detail Page
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TemplateDetail } from "@/components/workspace/studio";

interface TemplateDetailPageProps {
  params: Promise<{
    templateId: string;
  }>;
}

export default async function TemplateDetailPage({
  params,
}: TemplateDetailPageProps) {
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
          <h1 className="text-xl font-semibold">Template Details</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            View template information and create articles
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <TemplateDetail templateId={templateId} />
      </div>
    </div>
  );
}
