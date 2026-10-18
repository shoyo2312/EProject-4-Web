"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { Accessory, ROW_CLASS, RowBody } from "@/components/settings/rows/parts";
import { DownloadDataTab } from "@/components/settings/rows/download-data/DownloadDataTab";
import { RequestDataTab } from "@/components/settings/rows/download-data/RequestDataTab";
import { toast } from "@/components/ui/toast";
import { useDataExports } from "@/hooks/use-data-exports";
import {
  DATA_EXPORT_AVAILABLE_DAYS,
  DATA_EXPORT_CATEGORIES,
  hasProcessingExport,
} from "@/lib/account/data-export";
import type { DataExportCategory, DataExportFormat } from "@/lib/api/data-export";
import { messageFor } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

type Tab = "request" | "download";

/** Privacy → "Download your data". Signed out, it asks to log in first. */
export function DownloadDataRow({ row, onOpen }: { row: SettingsRow; onOpen: () => void }) {
  const { requireSignIn } = useSession();

  return (
    <button
      type="button"
      onClick={() => {
        if (requireSignIn()) onOpen();
      }}
      className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}
    >
      <RowBody row={row} />
      <Accessory row={row} />
    </button>
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: "request", label: "Request data" },
  { value: "download", label: "Download data" },
];

/**
 * Privacy → "Download your data", in the panel as it is live: a page of its
 * own that fills the panel, with a fixed footer button under a scrolling body.
 * The file is built by user-service in the background — see `useDataExports`.
 *
 * Measured live, in the 680 × panel-height frame:
 *   frame    #252525, `padding: 0 8px`
 *   title    24/32/700 `.9`, the line under it 15/19.5 `.88` 8 below, 4 under
 *            the block
 *   tabs     two 330 × 40 buttons, 2 in from either side, `padding: 8px 10px`,
 *            16/24/500 `.9` / `.5`; a 0.5px `rgba(255,255,255,.2)` rule under
 *            them with a 2px `.9` bar under the open one
 *   footer   `padding-top: 12px` (24 on Download data), a 664 × 48 button,
 *            radius 8, `padding: 0 24px`, 16/21/500 on #FE2C55, `.4` while
 *            a request is processing
 */
export function DownloadDataPanel({ onLeave }: { onLeave: () => void }) {
  const { user } = useSession();
  useEffect(() => {
    if (!user) onLeave();
  }, [user, onLeave]);

  return user ? <DownloadData /> : null;
}

/** Mounted only while signed in, so every read below is the viewer's own. */
function DownloadData() {
  const { requests, request, cancel, refresh } = useDataExports();
  const [tab, setTab] = useState<Tab>("request");
  const [format, setFormat] = useState<DataExportFormat>("TXT");
  const [selected, setSelected] = useState<DataExportCategory[]>(() =>
    DATA_EXPORT_CATEGORIES.map((c) => c.value),
  );
  const [submitting, setSubmitting] = useState(false);
  const processing = requests !== null && hasProcessingExport(requests);

  const submit = async () => {
    setSubmitting(true);
    try {
      await request({ format, categories: selected });
      toast.success("Your data request is being processed");
      setTab("download");
    } catch (cause) {
      toast.error(messageFor(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col px-2 pt-4">
      <div className="mb-1">
        <h1 className="text-[24px] leading-8 font-bold text-[rgb(255_255_255/0.9)]">Download Nowa data</h1>
        <p className="mt-2 text-[15px] leading-[19.5px] text-[rgb(255_255_255/0.88)]">
          {tab === "request"
            ? "You can request a copy of your data at any time to back up your account or export it to other services."
            : `When your file is ready for download, it’ll be available for ${DATA_EXPORT_AVAILABLE_DAYS} days. If you submit another request, your existing file will expire.`}
        </p>
      </div>

      <div role="tablist" className="relative mx-0.5 flex flex-none">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "h-10 flex-1 px-2.5 py-2 text-[16px] leading-6 font-medium transition-colors",
              tab === t.value ? "text-[rgb(255_255_255/0.9)]" : "text-[rgb(255_255_255/0.5)]",
            )}
          >
            {t.label}
          </button>
        ))}
        <span className="absolute inset-x-0 bottom-[-2px] h-0.5 border-b-[0.5px] border-[rgb(255_255_255/0.2)]" />
        <span
          className={cn(
            "absolute bottom-[-2px] left-0 h-0.5 w-1/2 bg-[rgb(255_255_255/0.9)] transition-transform duration-300",
            tab === "download" && "translate-x-full",
          )}
        />
      </div>
      <div className="h-0.5 flex-none" />

      {tab === "request" ? (
        <RequestDataTab
          format={format}
          onFormat={setFormat}
          selected={selected}
          onSelected={setSelected}
          locked={processing}
        />
      ) : (
        <DownloadDataTab requests={requests} onCancel={cancel} onStale={refresh} />
      )}

      <div className={cn("flex-none", tab === "request" ? "pt-3" : "pt-6")}>
        <button
          type="button"
          onClick={tab === "request" ? submit : () => setTab("request")}
          disabled={
            requests === null || processing || (tab === "request" && (selected.length === 0 || submitting))
          }
          className="h-12 w-full rounded-[8px] bg-[var(--tt-red)] px-6 text-[16px] leading-[21px] font-medium text-white transition-colors enabled:hover:bg-[var(--tt-red-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {processing ? "Processing request" : "Request data"}
        </button>
      </div>
    </div>
  );
}
