"use client";

import { Button } from "@/components/ui/button";

export function RuntimeSessionTabs({
  sessionIds,
  selectedSessionId,
  onSelect,
}: {
  sessionIds: string[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  if (sessionIds.length <= 1) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {sessionIds.map((id, i) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant={selectedSessionId === id ? "default" : "outline"}
          className="max-w-[160px] truncate text-xs"
          title={id}
          onClick={() => onSelect(id)}
        >
          会话 {i + 1}
        </Button>
      ))}
    </div>
  );
}
