"use client";

import { format } from "date-fns";
import { AlertCircle, Info, CheckCircle, AlertTriangle } from "lucide-react";

import type { RuntimeEvent } from "@/core/studio/types/runtime";
import { cn } from "@/lib/utils";

const severityIcon = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

export function RuntimeEventRow({ event }: { event: RuntimeEvent }) {
  const sev = event.display.severity || "info";
  const Icon = severityIcon[sev as keyof typeof severityIcon] ?? Info;

  return (
    <div className="border-border flex gap-2 border-b py-2 text-sm last:border-0">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          sev === "success" && "text-green-600",
          sev === "warning" && "text-amber-600",
          sev === "error" && "text-destructive",
          sev === "info" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{event.display.title}</span>
          <span className="text-muted-foreground text-xs">
            #{event.seq} · {event.eventType}
          </span>
        </div>
        {event.display.content ? (
          <pre className="text-muted-foreground mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs">
            {event.display.content}
          </pre>
        ) : null}
        <p className="text-muted-foreground mt-1 text-[10px]">
          {(() => {
            try {
              return format(new Date(event.createdAt), "yyyy-MM-dd HH:mm:ss");
            } catch {
              return event.createdAt;
            }
          })()}
        </p>
      </div>
    </div>
  );
}
