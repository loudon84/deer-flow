"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLayoutEffect, useMemo, useState } from "react";
import { loadArtifactContent, loadArtifactContentFromToolCall } from "@/core/artifacts/loader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/core/i18n/hooks";
import { checkCodeFile, getFileName } from "@/core/utils/files";
import { cn } from "@/lib/utils";
import { useThread } from "../messages/context";
import { useContext } from "react";
import { ThreadContext } from "../messages/context";
import { getAPIClient } from "@/core/api";
import type { AgentThreadState } from "@/core/threads/types";

// 安全地获取 thread context，如果不在 provider 内部则返回 undefined
function useThreadSafe() {
  const context = useContext(ThreadContext);
  return context === undefined ? undefined : context;
}


const BlockNoteEditorDynamic = dynamic(
  () =>
    import("@/components/ai-elements/blocknote-editor").then((mod) => ({
      default: mod.BlockNoteEditor,
    })),
  { ssr: false },
);

/** sessionStorage：全页编辑在无 ThreadContext 时仍可读 write-file 等内容快照 */
export const ARTIFACT_MARKDOWN_EDIT_SNAPSHOT_KEY = "deerflow-artifact-markdown-edit";

export type ArtifactMarkdownEditSnapshot = {
  threadId: string;
  /**
   * 解码后的路径（与详情页/编辑页内部的 decodedPath 一致）
   * 用于规避 URL searchParams 解码导致的字符串不一致问题。
   */
  decodedPath: string;
  /**
   * 原始 filepath（来自 URL query 参数，通常未 decode 或 decode 与不同浏览器存在差异）。
   * 用于在 decodedPath 不一致时兜底匹配。
   */
  filepath: string;
  markdown: string;
};

export function stashArtifactMarkdownForEdit(snapshot: ArtifactMarkdownEditSnapshot) {
  sessionStorage.setItem(ARTIFACT_MARKDOWN_EDIT_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function buildArtifactMarkdownEditHref(
  threadId: string,
  filepath: string,
  returnTo: string,
  isMock?: boolean,
) {
  const q = new URLSearchParams();
  q.set("filepath", filepath);
  q.set("returnTo", returnTo);
  q.set("isMock", String(Boolean(isMock)));
  return `/workspace/chats/${threadId}/artifacts/edit?${q.toString()}`;
}

function consumeSnapshotMarkdown(
  threadId: string,
  filepathRaw: string,
  decodedPath: string,
): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(ARTIFACT_MARKDOWN_EDIT_SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }
    const o = JSON.parse(raw) as ArtifactMarkdownEditSnapshot;
    if (o.threadId === threadId) {
      const normalizeMaybe = (p: string) => {
        try {
          return decodeURIComponent(p);
        } catch {
          return p;
        }
      };

      const decodedFromFilepath = normalizeMaybe(o.filepath);
      const decodedFromDecodedPath = normalizeMaybe(o.decodedPath);

      if (
        o.decodedPath === decodedPath ||
        decodedFromFilepath === decodedPath ||
        decodedFromDecodedPath === decodedPath ||
        o.filepath === filepathRaw ||
        normalizeMaybe(o.filepath) === normalizeMaybe(filepathRaw)
      ) {
        sessionStorage.removeItem(ARTIFACT_MARKDOWN_EDIT_SNAPSHOT_KEY);
        return o.markdown;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function ArtifactFileEdit({
  threadId,
  filepath,
  isMock,
  returnHref,
  className,
}: {
  threadId: string;
  filepath: string;
  isMock?: boolean;
  /** 返回目标，缺省为对应会话页 */
  returnHref?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const threadContext = useThreadSafe();
  const [snapshotMarkdown, setSnapshotMarkdown] = useState<string | null>(null);

  const isWriteFile = useMemo(
    () => filepath.startsWith("write-file:"),
    [filepath],
  );
  const decodedPath = useMemo(() => {
    if (isWriteFile) {
      return decodeURIComponent(new URL(filepath).pathname);
    }
    try {
      return decodeURIComponent(filepath);
    } catch {
      return filepath;
    }
  }, [filepath, isWriteFile]);
  const isSkillFile = useMemo(() => decodedPath.endsWith(".skill"), [decodedPath]);
  const { language } = useMemo(() => {
    if (isWriteFile) {
      let language = checkCodeFile(decodedPath).language;
      language ??= "text";
      return { language };
    }
    if (isSkillFile) {
      return { language: "markdown" as const };
    }
    return checkCodeFile(decodedPath);
  }, [decodedPath, isWriteFile, isSkillFile]);

  useLayoutEffect(() => {
    setSnapshotMarkdown(
      consumeSnapshotMarkdown(threadId, filepath, decodedPath),
    );
  }, [threadId, filepath, decodedPath]);

  // 从 thread context 中提取 write-file 内容
  const writeFileContentFromContext = useMemo(() => {
    if (isWriteFile && threadContext?.thread) {
      return loadArtifactContentFromToolCall({ url: filepath, thread: threadContext.thread });
    }
    return null;
  }, [isWriteFile, filepath, threadContext]);

  // 如果不在 ThreadContext 内部，从 API 获取 thread 状态
  const shouldFetchThread = isWriteFile && !threadContext && Boolean(threadId);
  const { data: threadState } = useQuery({
    queryKey: ["thread-state", threadId],
    queryFn: async () => {
      const apiClient = getAPIClient(isMock);
      const state = await apiClient.threads.getState<AgentThreadState>(threadId);
      return state.values;
    },
    enabled: shouldFetchThread,
    staleTime: 5 * 60 * 1000,
  });

  // 从 API 获取的 thread 状态中提取 write-file 内容
  const writeFileContentFromAPI = useMemo(() => {
    if (isWriteFile && threadState && threadState.messages) {
      // 构造一个兼容的 thread 对象
      const threadLike = { messages: threadState.messages };
      return loadArtifactContentFromToolCall({ url: filepath, thread: threadLike as any });
    }
    return null;
  }, [isWriteFile, filepath, threadState]);

  // 合并两个来源
  const writeFileContent = writeFileContentFromContext ?? writeFileContentFromAPI;


  const shouldFetch =
    !isWriteFile && Boolean(decodedPath) && Boolean(threadId);

  const { data, isLoading, isError } = useQuery({
    // 使用 decodedPath（归一化/解码后的真实路径）以支持虚拟路径 outputs 等场景
    queryKey: ["artifact", decodedPath, threadId, isMock],
    queryFn: () => {
      return loadArtifactContent({ filepath: decodedPath, threadId, isMock });
    },
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000,
  });

  // 优先使用快照：它是从详情页“同一时刻”的 displayContent 兜底得到的。
  // 避免后端偶发返回空字符串时，覆盖掉快照导致正文仍为空白。
  const markdown = snapshotMarkdown ?? writeFileContent ?? data?.content ?? "";

  const backHref = returnHref ?? `/workspace/chats/${threadId}`;
  const isMarkdown = language === "markdown";
  return (
    <div
      className={cn(
        "bg-background flex min-h-0 flex-1 flex-col",
        className,
      )}
    >
      <header className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={backHref} aria-label={t.common.back}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <h1 className="text-foreground min-w-0 truncate text-sm font-medium">
          {getFileName(decodedPath)}
        </h1>
        <span className="text-muted-foreground ml-auto text-xs">{t.common.edit}</span>
      </header>
      <main className="flex min-h-0 flex-1 flex-col p-4 pt-2">
        {!isMarkdown ? (
          <p className="text-muted-foreground text-sm">
            仅支持 Markdown 可视化编辑。
            <Link className="text-primary ml-2 underline" href={backHref}>
              {t.common.back}
            </Link>
          </p>
        ) : !isWriteFile && !isLoading && !isError && !markdown ? (
          <p className="text-muted-foreground text-sm">
            未读取到正文内容（返回为空）。
            <Link className="text-primary ml-2 underline" href={backHref}>
              {t.common.back}
            </Link>
          </p>
        ) : (
          <BlockNoteEditorDynamic
            key={filepath}
            className="min-h-0 flex-1"
            markdown={markdown}
          />
        )}
      </main>
    </div>
  );
}
