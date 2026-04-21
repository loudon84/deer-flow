"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RuntimeSession } from "@/core/studio/types/runtime";

export function RuntimeStatusCard({
  session,
  isLive,
}: {
  session: RuntimeSession | null;
  isLive?: boolean;
}) {
  if (!session) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Runtime</CardTitle>
          <CardDescription>未关联会话</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Runtime 状态</CardTitle>
          <div className="flex items-center gap-1">
            {isLive ? (
              <Badge variant="default" className="text-xs">
                实时
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                轮询
              </Badge>
            )}
            <Badge variant="outline">{session.status}</Badge>
          </div>
        </div>
        <CardDescription className="font-mono text-xs break-all">
          thread: {session.threadId}
        </CardDescription>
      </CardHeader>
      {/*
      <CardContent className="space-y-1 pb-3 text-xs">
        <p>
          <span className="text-muted-foreground">lastEventSeq:</span>{" "}
          {session.summary.lastEventSeq}
        </p>
        {session.summary.latestAssistantText ? (
          <p className="text-muted-foreground line-clamp-3">
            {session.summary.latestAssistantText}
          </p>
        ) : null}
      </CardContent>
      */}
    </Card>
  );
}
