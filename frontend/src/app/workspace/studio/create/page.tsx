/**
 * Create Article Page
 */

import { ArticleCreateForm } from "@/components/workspace/studio";

export default function CreateArticlePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Article</h1>
        <p className="text-muted-foreground">
          Generate a new article using a template
        </p>
      </div>
      <ArticleCreateForm />
    </div>
  );
}
