"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { RuntimeEvent } from "@/core/studio/types/runtime";

import { RuntimeEventRow } from "./RuntimeEventRow";

export function RuntimeTimeline({
  events,
  emptyText = "暂无事件",
}: {
  events: RuntimeEvent[];
  emptyText?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">{emptyText}</p>
    );
  }

  return (
    <ScrollArea className="h-[min(420px,50vh)] pr-3">
      <div className="space-y-0">
        {events.map((e) => (
          <RuntimeEventRow key={e.eventId} event={e} />
        ))}
      </div>
    </ScrollArea>
  );
}
