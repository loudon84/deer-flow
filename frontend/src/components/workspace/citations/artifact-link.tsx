import type { AnchorHTMLAttributes } from "react";

import { urlOfArtifact } from "@/core/artifacts/utils";
import { cn } from "@/lib/utils";

import { CitationLink } from "./citation-link";

function isExternalUrl(href: string | undefined): boolean {
  return !!href && /^https?:\/\//.test(href);
}

function isVirtualPath(href: string | undefined): boolean {
  if (!href) return false;
  // 检测虚拟路径格式：/mnt/user-data/... 或 mnt/user-data/...
  return href.startsWith("/mnt/user-data") || href.startsWith("mnt/user-data");
}

/** Link renderer for artifact markdown: citation: prefix → CitationLink, virtual paths → artifact URL, otherwise underlined text. */
export function ArtifactLink(props: AnchorHTMLAttributes<HTMLAnchorElement> & { threadId?: string }) {
  if (typeof props.children === "string") {
    const match = /^citation:(.+)$/.exec(props.children);
    if (match) {
      const [, text] = match;
      return <CitationLink {...props}>{text}</CitationLink>;
    }
  }

  const { className, target, rel, threadId, ...rest } = props;
  let href = props.href;
  const external = isExternalUrl(href);

  // 如果是虚拟路径且提供了threadId，转换为artifact API URL
  if (isVirtualPath(href) && threadId) {
    // 确保路径以 / 开头
    const normalizedPath = href.startsWith("/") ? href : `/${href}`;
    href = urlOfArtifact({ filepath: normalizedPath, threadId, download: true });
  }

  return (
    <a
      {...rest}
      href={href}
      className={cn(
        "text-primary decoration-primary/30 hover:decoration-primary/60 underline underline-offset-2 transition-colors",
        className,
      )}
      target={target ?? (external ? "_blank" : undefined)}
      rel={rel ?? (external ? "noopener noreferrer" : undefined)}
    />
  );
}
