/**
 * Job Detail Page
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { JobDetail, RuntimePanel } from "@/components/workspace/studio";

interface JobDetailPageProps {
  params: Promise<{
    jobId: string;
  }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params;

  if (!jobId) {
    notFound();
  }

  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="flex items-center gap-4 border-b px-6 py-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workspace/studio/jobs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Job Details</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            View job status and generated document
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6 lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <JobDetail jobId={jobId} />
        </div>
        <aside className="border-border w-full shrink-0 lg:w-[420px] lg:border-l lg:pl-6">          
          <RuntimePanel
            ownerType="job"
            ownerId={jobId}
            autoCreate
            mode="job"
          />
        </aside>
      </div>
    </div>
  );
}
