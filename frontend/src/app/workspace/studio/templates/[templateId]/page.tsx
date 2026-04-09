/**
 * Template Detail Page
 */

import { notFound } from "next/navigation";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Template Details</h1>
        <p className="text-muted-foreground">
          View template information and create articles
        </p>
      </div>
      <TemplateDetail templateId={templateId} />
    </div>
  );
}
