"use client";

import { ChevronDown, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RuntimeTimeline } from "@/components/workspace/studio/runtime/RuntimeTimeline";
import type { RuntimeEvent } from "@/core/studio/types/runtime";

/**
 * ChatEventTimeline — 复用 RuntimeTimeline，包装为可折叠面板
 */
export function ChatEventTimeline({
  events,
  isLive,
  onReconnect,
}: {
  events: RuntimeEvent[];
  isLive?: boolean;
  onReconnect: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronDown
              className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
            <span className="text-xs font-medium">事件时间线</span>
            {events.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {events.length}
              </Badge>
            )}
            {isLive ? (
              <Badge variant="default" className="text-[10px]">
                实时
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                轮询
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>

        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onReconnect}
        >
          <RefreshCw className="size-3" />
        </Button>
      </div>

      <CollapsibleContent className="mt-2">
        <RuntimeTimeline events={events} />
      </CollapsibleContent>
    </Collapsible>
  );
}
