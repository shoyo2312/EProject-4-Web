"use client";

import { apiFetch } from "@/lib/api/client";

/**
 * user-service's "Download your data". The archive is built in the background,
 * so a request comes back PROCESSING and the list is polled until it turns
 * READY; the file itself is fetched from a short-lived signed link.
 */

export type DataExportFormat = "TXT" | "JSON";

export type DataExportCategory =
  | "DIRECT_MESSAGES"
  | "LIKES_AND_FAVORITES"
  | "POSTS"
  | "PROFILE_AND_SETTINGS"
  | "YOUR_ACTIVITY";

export type DataExportStatus = "PROCESSING" | "READY" | "CANCELED" | "FAILED" | "EXPIRED";

export interface DataExportResponse {
  id: string;
  format: DataExportFormat;
  categories: DataExportCategory[];
  status: DataExportStatus;
  requestedAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  sizeBytes: string | number | null;
}

export interface DataExportDownloadResponse {
  url: string;
  expiresAt: string;
}

/** `GET /api/v1/users/me/data-exports` — the latest requests, newest first. */
export function listDataExports(): Promise<DataExportResponse[]> {
  return apiFetch<DataExportResponse[]>("/users/me/data-exports", { auth: "required" });
}

/**
 * `POST /api/v1/users/me/data-exports`. A file already ready expires.
 * 409 `DATA_EXPORT_IN_PROGRESS` while another request is processing.
 */
export function requestDataExport(input: {
  format: DataExportFormat;
  categories: DataExportCategory[];
}): Promise<DataExportResponse> {
  return apiFetch<DataExportResponse>("/users/me/data-exports", {
    method: "POST",
    body: input,
    auth: "required",
  });
}

/** `POST /api/v1/users/me/data-exports/{id}/cancel` — 409 `DATA_EXPORT_NOT_CANCELABLE` once it is done. */
export function cancelDataExport(id: string): Promise<DataExportResponse> {
  return apiFetch<DataExportResponse>(`/users/me/data-exports/${id}/cancel`, {
    method: "POST",
    auth: "required",
  });
}

/** `GET /api/v1/users/me/data-exports/{id}/download-url` — 409 `DATA_EXPORT_UNAVAILABLE` unless ready. */
export function getDataExportDownloadUrl(id: string): Promise<DataExportDownloadResponse> {
  return apiFetch<DataExportDownloadResponse>(`/users/me/data-exports/${id}/download-url`, {
    auth: "required",
  });
}
