/**
 * Studio Home Page - Redirect to Templates
 */

import { redirect } from "next/navigation";

export default function StudioPage() {
  redirect("/workspace/studio/templates");
}
