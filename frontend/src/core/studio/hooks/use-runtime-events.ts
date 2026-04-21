/**
 * Runtime events: initial list + SSE with polling fallback.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  listRuntimeEvents,
  openRuntimeEventStream,
} from "../api/runtime-events";
import type { RuntimeEvent } from "../types/runtime";

function mergeEvents(prev: RuntimeEvent[], incoming: RuntimeEvent[]): RuntimeEvent[] {
  const byId = new Map<string, RuntimeEvent>();
  for (const e of prev) {
    byId.set(e.eventId, e);
  }
  for (const e of incoming) {
    byId.set(e.eventId, e);
  }
  return Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
}

function maxSeq(list: RuntimeEvent[]): number {
  if (list.length === 0) return 0;
  return Math.max(...list.map((e) => e.seq));
}

export function useRuntimeEvents(sessionId: string | undefined) {
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [lastSeq, setLastSeq] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const lastSeqRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeStreamRef = useRef<(() => void) | null>(null);
  const lastEventAtRef = useRef<number>(Date.now());
  const finishedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const applyMerged = useCallback((incoming: RuntimeEvent[]) => {
    setEvents((prev) => {
      const merged = mergeEvents(prev, incoming);
      const m = maxSeq(merged);
      lastSeqRef.current = m;
      return merged;
    });
  }, []);

  const startPolling = useCallback(
    (sid: string) => {
      stopPolling();
      pollTimerRef.current = setInterval(() => {
        if (finishedRef.current) {
          stopPolling();
          return;
        }
        void (async () => {
          try {
            const cursor = lastSeqRef.current;
            const resp = await listRuntimeEvents(sid, cursor, 100);
            if (resp.items.length > 0) {
              applyMerged(resp.items);
            }
          } catch {
            // ignore
          }
        })();
      }, 2000);
    },
    [applyMerged, stopPolling],
  );

  const loadInitial = useCallback(async (sid: string) => {
    const resp = await listRuntimeEvents(sid, 0, 200);
    lastSeqRef.current = resp.items.length ? maxSeq(resp.items) : 0;
    setEvents(resp.items);
  }, []);

  useEffect(() => {
    if (events.length === 0) {
      setLastSeq(0);
      return;
    }
    setLastSeq(maxSeq(events));
  }, [events]);

  const connectStream = useCallback(
    (sid: string) => {
      closeStreamRef.current?.();
      lastEventAtRef.current = Date.now();
      setIsLive(true);
      stopPolling();

      const stopWatchdog = () => {
        if (watchdogRef.current) {
          clearInterval(watchdogRef.current);
          watchdogRef.current = null;
        }
      };

      watchdogRef.current = setInterval(() => {
        if (Date.now() - lastEventAtRef.current > 5000) {
          stopWatchdog();
          closeStreamRef.current?.();
          closeStreamRef.current = null;
          setIsLive(false);
          startPolling(sid);
        }
      }, 2500);

      const close = openRuntimeEventStream(
        sid,
        (ev) => {
          lastEventAtRef.current = Date.now();
          applyMerged([ev]);
        },
        () => {
          stopWatchdog();
          setIsLive(false);
          startPolling(sid);
        },
        (_status) => {
          // 服务端通知 session 已进入终态，停止 SSE 和轮询
          finishedRef.current = true;
          stopWatchdog();
          stopPolling();
          setIsLive(false);
        },
      );
      closeStreamRef.current = () => {
        stopWatchdog();
        close();
      };
    },
    [applyMerged, startPolling, stopPolling],
  );

  const reconnect = useCallback(() => {
    if (!sessionId) return;
    void loadInitial(sessionId).then(() => connectStream(sessionId));
  }, [sessionId, loadInitial, connectStream]);

  useEffect(() => {
    if (!sessionId) {
      setEvents([]);
      lastSeqRef.current = 0;
      setLastSeq(0);
      setIsLive(false);
      finishedRef.current = false;
      return undefined;
    }

    let cancelled = false;
    finishedRef.current = false;

    void (async () => {
      try {
        await loadInitial(sessionId);
        if (cancelled) return;
        connectStream(sessionId);
      } catch {
        if (!cancelled) startPolling(sessionId);
      }
    })();

    return () => {
      cancelled = true;
      closeStreamRef.current?.();
      closeStreamRef.current = null;
      stopPolling();
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, [sessionId, loadInitial, connectStream, startPolling, stopPolling]);

  return {
    events,
    lastSeq,
    isLive,
    reconnect,
    reload: async () => {
      if (!sessionId) return;
      await loadInitial(sessionId);
    },
  };
}
