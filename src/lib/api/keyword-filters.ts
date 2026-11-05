"use client";

import { apiFetch } from "@/lib/api/client";

/**
 * user-service's feed keyword filters, under `/users/me/keyword-filters`:
 * video-service leaves a matching video out of each feed ticked here.
 */

export interface KeywordFilter {
  /** Snowflake, kept as a string. */
  id: string;
  keyword: string;
  forYou: boolean;
  following: boolean;
  friends: boolean;
}

export type KeywordFilterInput = Omit<KeywordFilter, "id">;

const PATH = "/users/me/keyword-filters";

/** Newest first. */
export function listKeywordFilters(): Promise<KeywordFilter[]> {
  return apiFetch<KeywordFilter[]>(PATH, { auth: "required" });
}

/** 409 `KEYWORD_FILTER_DUPLICATE` in any capitalization, 409 `TOO_MANY_KEYWORD_FILTERS` past 100. */
export function createKeywordFilter(input: KeywordFilterInput): Promise<KeywordFilter> {
  return apiFetch<KeywordFilter>(PATH, { method: "POST", body: input, auth: "required" });
}

export function updateKeywordFilter(id: string, input: KeywordFilterInput): Promise<KeywordFilter> {
  return apiFetch<KeywordFilter>(`${PATH}/${id}`, { method: "PUT", body: input, auth: "required" });
}

export function deleteKeywordFilter(id: string): Promise<void> {
  return apiFetch<void>(`${PATH}/${id}`, { method: "DELETE", auth: "required" });
}
