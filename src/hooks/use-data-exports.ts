"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "@/components/ui/toast";
import { hasProcessingExport } from "@/lib/account/data-export";
import {
  cancelDataExport,
  type DataExportCategory,
  type DataExportFormat,
  type DataExportResponse,
  listDataExports,
  requestDataExport,
} from "@/lib/api/data-export";
import { messageFor } from "@/lib/api/errors";

/** How often the list is re-read while a file is being made. */
const POLL_MS = 10_000;

export interface DataExports {
  /** Null until the first read lands. */
  requests: DataExportResponse[] | null;
  /** Queues a new file. Throws `ApiError`. */
  request: (input: { format: DataExportFormat; categories: DataExportCategory[] }) => Promise<void>;
  /** Throws `ApiError`, after re-reading the list: a refusal means it was stale. */
  cancel: (id: string) => Promise<void>;
  /** Re-reads the list quietly. */
  refresh: () => void;
}

/**
 * The viewer's data requests. The file is built in the background, so while
 * one is processing the list is polled until it turns ready.
 */
export function useDataExports(): DataExports {
  const [requests, setRequests] = useState<DataExportResponse[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDataExports().then(
      (value) => {
        if (!cancelled) setRequests(value);
      },
      (cause) => {
        if (!cancelled) toast.error(messageFor(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Quiet: a missed read is retried by the next poll or click.
  const refresh = useCallback(() => {
    listDataExports().then(setRequests, () => {});
  }, []);

  const processing = requests !== null && hasProcessingExport(requests);
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [processing, refresh]);

  const request = useCallback<DataExports["request"]>(async (input) => {
    const created = await requestDataExport(input);
    // The server expires the previous file in the same step.
    setRequests((current) => [
      created,
      ...(current ?? []).map((r) => (r.status === "READY" ? { ...r, status: "EXPIRED" as const } : r)),
    ]);
  }, []);

  const cancel = useCallback<DataExports["cancel"]>(
    async (id) => {
      let canceled: DataExportResponse;
      try {
        canceled = await cancelDataExport(id);
      } catch (cause) {
        // Usually the file finished between the last poll and the click.
        refresh();
        throw cause;
      }
      setRequests((current) => (current ?? []).map((r) => (r.id === id ? canceled : r)));
    },
    [refresh],
  );

  return { requests, request, cancel, refresh };
}
