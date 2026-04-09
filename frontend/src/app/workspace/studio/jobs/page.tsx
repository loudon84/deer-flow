/**
 * Jobs List Page
 */

import { JobList } from "@/components/workspace/studio";

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="text-muted-foreground">
          View and manage article generation jobs
        </p>
      </div>
      <JobList />
    </div>
  );
}
