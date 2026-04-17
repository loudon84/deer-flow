"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import "@/styles/blocknote-editor.css";

import type { BlockNoteEditor as BNEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { useCreateBlockNote } from "@blocknote/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type BlockNoteEditorProps = {
  markdown: string;
  className?: string;
  /** 为 false 时只读，且不显示格式化工具栏、斜杠菜单等 */
  editable?: boolean;
  /** 左侧标题目录；默认可见，长文编辑时可快速跳转 */
  showTOC?: boolean;
};

type HeadingBlock = {
  id: string;
  level: number;
  text: string;
};

type FlatBlock = { id: string; type: string };

function extractHeadings(blocks: unknown[]): HeadingBlock[] {
  const headings: HeadingBlock[] = [];

  function traverseBlocks(blockList: unknown[]) {
    for (const block of blockList) {
      const b = block as {
        type?: string;
        id?: string;
        content?: unknown;
        props?: { level?: number };
        children?: unknown[];
      };

      if (b.type === "heading" && b.id && b.content) {
        const text = Array.isArray(b.content)
          ? b.content.map((c: { text?: string }) => c.text || "").join("")
          : "";

        if (text.trim()) {
          headings.push({
            id: b.id,
            level: b.props?.level ?? 1,
            text: text.trim(),
          });
        }
      }

      if (b.children && b.children.length > 0) {
        traverseBlocks(b.children as unknown[]);
      }
    }
  }

  traverseBlocks(blocks);
  return headings;
}

function flattenBlocksInOrder(blocks: unknown[], acc: FlatBlock[] = []): FlatBlock[] {
  for (const block of blocks) {
    const b = block as { id?: string; type?: string; children?: unknown[] };
    if (b.id && b.type) {
      acc.push({ id: b.id, type: b.type });
    }
    if (b.children?.length) {
      flattenBlocksInOrder(b.children as unknown[], acc);
    }
  }
  return acc;
}

/** 光标所在位置对应的「当前章节」标题（光标上方最近的 heading） */
function getActiveHeadingId(editor: BNEditor): string | null {
  try {
    const cursor = editor.getTextCursorPosition();
    const cursorId = cursor.block.id;
    const flat = flattenBlocksInOrder(editor.document);
    const idx = flat.findIndex((x) => x.id === cursorId);
    if (idx < 0) {
      return null;
    }
    let lastHeadingId: string | null = null;
    for (let i = 0; i <= idx; i++) {
      if (flat[i]!.type === "heading") {
        lastHeadingId = flat[i]!.id;
      }
    }
    return lastHeadingId;
  } catch {
    return null;
  }
}

export function BlockNoteEditor({
  markdown,
  className,
  editable = true,
  showTOC = true,
}: BlockNoteEditorProps) {
  const editor = useCreateBlockNote({});
  const lastLoadedRef = useRef<string | null>(null);
  const [headings, setHeadings] = useState<HeadingBlock[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const refreshTOC = useCallback(() => {
    if (!showTOC) {
      return;
    }
    const next = extractHeadings(editor.document as unknown[]);
    setHeadings(next);
    setActiveHeadingId(getActiveHeadingId(editor));
  }, [editor, showTOC]);

  useEffect(() => {
    editor.isEditable = editable;
  }, [editor, editable]);

  useEffect(() => {
    if (lastLoadedRef.current === markdown) {
      return;
    }
    lastLoadedRef.current = markdown;
    const blocks = editor.tryParseMarkdownToBlocks(markdown);
    editor.replaceBlocks(editor.document, blocks);
    refreshTOC();
  }, [editor, markdown, refreshTOC]);

  useEffect(() => {
    if (!showTOC) {
      return;
    }
    refreshTOC();
  }, [showTOC, refreshTOC]);

  const handleSelectionChange = useCallback(() => {
    if (!showTOC) {
      return;
    }
    setActiveHeadingId(getActiveHeadingId(editor));
  }, [editor, showTOC]);

  const scrollToHeading = useCallback(
    (blockId: string) => {
      try {
        editor.setTextCursorPosition(blockId, "start");
        editor.focus();
        requestAnimationFrame(() => {
          const root = editor.domElement;
          const el = root?.querySelector(`[data-id="${blockId}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        setActiveHeadingId(blockId);
      } catch {
        // 块可能已被删除
      }
    },
    [editor],
  );

  const tocContent = useMemo(() => {
    if (!showTOC) {
      return null;
    }

    return (
      <div className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border px-3 py-2">
          <h3 className="text-sm font-semibold text-foreground">目录</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            选中文本可用浮动工具栏设样式；/ 打开块菜单；左侧手柄可拖动块
          </p>
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
          {headings.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">暂无标题</p>
          ) : (
            headings.map((heading) => (
              <button
                key={heading.id}
                type="button"
                onClick={() => scrollToHeading(heading.id)}
                className={cn(
                  "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  heading.id === activeHeadingId
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
                style={{
                  paddingLeft: `${(heading.level - 1) * 12 + 8}px`,
                }}
              >
                {heading.text}
              </button>
            ))
          )}
        </nav>
      </div>
    );
  }, [showTOC, headings, activeHeadingId, scrollToHeading]);

  const view = (
    <BlockNoteView
      className={cn(
        "blocknote-editor-root h-full min-h-0",
        /* 父级若有 select-none，仍须能选中、编辑正文与设置加粗/链接等样式 */
        "select-text [&_.bn-editor]:min-h-[12rem] [&_.bn-editor]:select-text",
      )}
      editable={editable}
      editor={editor}
      emojiPicker={editable}
      filePanel={editable}
      formattingToolbar={editable}
      linkToolbar={editable}
      onChange={showTOC ? refreshTOC : undefined}
      onSelectionChange={handleSelectionChange}
      sideMenu={editable}
      slashMenu={editable}
      tableHandles={editable}
      comments={false}
    />
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {showTOC ? (
        <div className="flex min-h-0 flex-1">
          {tocContent}
          <div className="min-w-0 flex-1 overflow-auto">{view}</div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">{view}</div>
      )}
    </div>
  );
}
