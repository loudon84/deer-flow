/**
 * Documents List Page
 */

import { DocumentList } from "@/components/workspace/studio";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground">
          View and manage generated documents
        </p>
      </div>
      <DocumentList />
    </div>
  );
}
