/**
 * Create Template Page
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreateTemplateForm } from "@/components/workspace/studio";

export default function CreateTemplatePage() {
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
          <h1 className="text-xl font-semibold">Create Template</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Create a new article template
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <CreateTemplateForm />
      </div>
    </div>
  );
}
