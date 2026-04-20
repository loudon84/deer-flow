/**
 * Jobs List Page
 */

import { JobList } from "@/components/workspace/studio";

export default function JobsPage() {
  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          View and manage article generation jobs
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <JobList />
      </div>
    </div>
  );
}
