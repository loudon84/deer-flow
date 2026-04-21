/**
 * Document Detail Page (Server Component)
 */

import { notFound } from "next/navigation";

import { DocumentDetailClient } from "./document-detail-client";

interface DocumentDetailPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

export default async function DocumentDetailPage({
  params,
}: DocumentDetailPageProps) {
  const { documentId } = await params;

  if (!documentId) {
    notFound();
  }

  return <DocumentDetailClient documentId={documentId} />;
}
