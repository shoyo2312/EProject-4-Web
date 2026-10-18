import type {
  DataExportCategory,
  DataExportResponse,
} from "@/lib/api/data-export";

/**
 * What can go in the file, in the order live lists them (alphabetical). Only
 * what Nowa keeps per account: there is no index of a user's comments, and no
 * wallet, LIVE, shop or location reviews, so those live rows have no
 * counterpart here.
 */
export const DATA_EXPORT_CATEGORIES: {
  value: DataExportCategory;
  label: string;
  description?: string;
}[] = [
  { value: "DIRECT_MESSAGES", label: "Direct Messages" },
  { value: "LIKES_AND_FAVORITES", label: "Likes and Favorites" },
  { value: "POSTS", label: "Posts" },
  { value: "PROFILE_AND_SETTINGS", label: "Profile and Settings" },
  {
    value: "YOUR_ACTIVITY",
    label: "Your Activity",
    description:
      "Includes the accounts you follow, your followers, your reposts, and the accounts you’ve blocked or muted",
  },
];

/** Days a finished file can be downloaded — user-service's `available-for`. */
export const DATA_EXPORT_AVAILABLE_DAYS = 4;

/**
 * Live keeps a request under "Active requests" while it is being made or can
 * still be downloaded, and everything else under "Past requests".
 */
export function splitDataExports(requests: readonly DataExportResponse[]): {
  active: DataExportResponse[];
  past: DataExportResponse[];
} {
  const active: DataExportResponse[] = [];
  const past: DataExportResponse[] = [];
  for (const request of requests) {
    (request.status === "PROCESSING" || request.status === "READY" ? active : past).push(request);
  }
  return { active, past };
}

export function hasProcessingExport(requests: readonly DataExportResponse[]): boolean {
  return requests.some((request) => request.status === "PROCESSING");
}

/** "Requested on Oct 18, 2026" — the live card's title. */
export function requestedOnLabel(requestedAt: string, locale?: string): string {
  const on = new Date(requestedAt).toLocaleDateString(locale ?? "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Requested on ${on}`;
}

/** The line under it: everything, or a part of it, and in which format. */
export function requestScopeLabel(request: Pick<DataExportResponse, "categories" | "format">): string {
  const all = DATA_EXPORT_CATEGORIES.every(({ value }) => request.categories.includes(value));
  return `${all ? "All available data" : "Selected data"} from Nowa · ${request.format} format`;
}

/** What a past request says where an active one has its button. */
export function pastStatusLabel(status: DataExportResponse["status"]): string {
  switch (status) {
    case "CANCELED":
      return "Canceled";
    case "FAILED":
      return "Failed";
    default:
      return "Expired";
  }
}
