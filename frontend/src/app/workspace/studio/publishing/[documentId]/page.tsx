/**
 * Publishing Document Detail Page (Server Component)
 */

import { notFound } from "next/navigation";

import { PublishingDetailClient } from "./publishing-detail-client";

interface PublishingDetailPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

export default async function PublishingDetailPage({
  params,
}: PublishingDetailPageProps) {
  const { documentId } = await params;

  if (!documentId) {
    notFound();
  }

  return <PublishingDetailClient documentId={documentId} />;
}
