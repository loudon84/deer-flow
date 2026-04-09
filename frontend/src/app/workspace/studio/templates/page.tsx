/**
 * Templates List Page
 */

import { TemplateList } from "@/components/workspace/studio";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-muted-foreground">
          Select a template to create articles
        </p>
      </div>
      <TemplateList />
    </div>
  );
}
