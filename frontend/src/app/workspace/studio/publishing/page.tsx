/**
 * Publishing List Page
 */

"use client";

import { PublishingList } from "@/components/workspace/studio";

export default function PublishingPage() {
  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Publishing</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            View documents pending approval and approved for publication
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <PublishingList />
      </div>
    </div>
  );
}
