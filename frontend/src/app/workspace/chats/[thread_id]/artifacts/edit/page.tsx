"use client";

import { useParams, useSearchParams } from "next/navigation";

import { ArtifactFileEdit } from "@/components/workspace/artifacts/artifact-file-edit";

export default function ArtifactMarkdownEditPage() {
  const { thread_id } = useParams<{ thread_id: string }>();
  const searchParams = useSearchParams();
  const filepath = searchParams.get("filepath") ?? "";
  const returnTo =
    searchParams.get("returnTo") ?? `/workspace/chats/${thread_id}`;
  const isMock =
    searchParams.get("isMock") === "true" ||
    searchParams.get("isMock") === "1";

  if (!filepath) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        缺少 filepath 参数。
      </div>
    );
  }

  return (
    <div className="flex h-svh w-full min-h-0 flex-col">
      <ArtifactFileEdit
        threadId={thread_id}
        filepath={filepath}
        isMock={isMock}
        returnHref={returnTo}
      />
    </div>
  );
}
