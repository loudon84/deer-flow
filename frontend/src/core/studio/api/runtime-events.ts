/**
 * Runtime events API + SSE
 */

import { getArticleStudioBaseURL } from "@/core/config";

import type {
  RuntimeEvent,
  RuntimeEventListResponse,
  RuntimeEventStreamPayload,
} from "../types/runtime";

type EventItemApi = {
  eventId: string;
  seq: number;
  eventType: string;
  source: string;
  display: {
    title: string;
    content?: string | null;
    severity: string;
  };
  createdAt: string;
};

function mapItem(row: EventItemApi): RuntimeEvent {
  return {
    eventId: row.eventId,
    seq: row.seq,
    eventType: row.eventType,
    source: row.source as RuntimeEvent["source"],
    display: {
      title: row.display.title,
      content: row.display.content,
      severity: row.display.severity,
    },
    createdAt: row.createdAt,
  };
}

export async function listRuntimeEvents(
  sessionId: string,
  cursor = 0,
  limit = 100,
): Promise<RuntimeEventListResponse> {
  const base = getArticleStudioBaseURL();
  const q = new URLSearchParams({
    cursor: String(cursor),
    limit: String(limit),
  });
  const res = await fetch(
    `${base}/api/v1/runtime/sessions/${encodeURIComponent(sessionId)}/events?${q}`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    items: EventItemApi[];
    nextCursor: number | null;
  };
  return {
    items: data.items.map(mapItem),
    nextCursor: data.nextCursor,
  };
}

/**
 * Subscribe to SSE stream. Returns cleanup function.
 * Uses EventSource with `runtime_event` event type.
 * Listens for `runtime_done` to detect session completion.
 */
export function openRuntimeEventStream(
  sessionId: string,
  onEvent: (ev: RuntimeEvent) => void,
  onError?: () => void,
  onDone?: (status: string) => void,
): () => void {
  const base = getArticleStudioBaseURL();
  const url = `${base}/api/v1/runtime/sessions/${encodeURIComponent(sessionId)}/stream`;

  const es = new EventSource(url);

  const handle = (e: MessageEvent) => {
    try {
      const raw = JSON.parse(String(e.data)) as RuntimeEventStreamPayload;
      const mapped: RuntimeEvent = {
        eventId: raw.eventId,
        seq: raw.seq,
        eventType: raw.eventType,
        source: "system",
        display: raw.display ?? {
          title: raw.eventType,
          severity: "info",
        },
        createdAt: raw.createdAt,
      };
      onEvent(mapped);
    } catch {
      // ignore parse errors
    }
  };

  const handleDone = (e: MessageEvent) => {
    try {
      const raw = JSON.parse(String(e.data)) as { status: string };
      onDone?.(raw.status);
    } catch {
      onDone?.("completed");
    }
  };

  es.addEventListener("runtime_event", handle as EventListener);
  es.addEventListener("runtime_done", handleDone as EventListener);
  es.onerror = () => {
    onError?.();
  };

  return () => {
    es.removeEventListener("runtime_event", handle as EventListener);
    es.removeEventListener("runtime_done", handleDone as EventListener);
    es.close();
  };
}
