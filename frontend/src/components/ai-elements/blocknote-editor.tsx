"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import { BlockNoteView } from "@blocknote/shadcn";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type BlockNoteEditorProps = {
  markdown: string;
  className?: string;
  editable?: boolean;
};

export function BlockNoteEditor({
  markdown,
  className,
  editable = true,
}: BlockNoteEditorProps) {
  const editor = useCreateBlockNote({});
  const lastLoadedRef = useRef<string | null>(null);

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
  }, [editor, markdown]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <BlockNoteView className="min-h-0 flex-1" editor={editor} />
    </div>
  );
}
