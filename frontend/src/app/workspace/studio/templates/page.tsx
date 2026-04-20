/**
 * Templates List Page
 */

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { TemplateList } from "@/components/workspace/studio";

export default function TemplatesPage() {
  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Templates</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Select a template to create articles
          </p>
        </div>
        <Button asChild>
          <Link href="/workspace/studio/templates/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Create Template
          </Link>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <TemplateList />
      </div>
    </div>
  );
}
