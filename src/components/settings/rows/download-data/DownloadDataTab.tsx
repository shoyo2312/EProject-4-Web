"use client";

import { useId, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import {
  pastStatusLabel,
  requestScopeLabel,
  requestedOnLabel,
  splitDataExports,
} from "@/lib/account/data-export";
import { type DataExportResponse, getDataExportDownloadUrl } from "@/lib/api/data-export";
import { messageFor } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const HEADING = "my-4 text-[16px] leading-[20.8px] font-medium text-[rgb(246_246_246)]";
const PILL =
  "flex h-8 flex-none items-center justify-center rounded-full px-3 text-[15px] leading-[19px] font-medium disabled:cursor-not-allowed disabled:opacity-40";

/**
 * "Download data": what is still being made or can be downloaded, then what
 * is over.
 *
 * Measured live:
 *   headings 16/20.8/500 #F6F6F6, 16 above and below
 *   card     #2C2C2C, radius 8; "Requested on …" 16/20.8/500 `.9` at
 *            `padding: 16px 16px 6px`, the line under it 13/16.9 `.6` at
 *            `0 16px`, 12 under that; the 32-tall pill 16 off the right,
 *            `padding: 0 12px`, 15/19/500 on `rgba(255,255,255,.13)`
 */
export function DownloadDataTab({
  requests,
  onCancel,
  onStale,
}: {
  requests: DataExportResponse[] | null;
  onCancel: (id: string) => Promise<void>;
  /** A download was refused: the file expired or was replaced since the last read. */
  onStale: () => void;
}) {
  const [canceling, setCanceling] = useState<DataExportResponse | null>(null);

  if (requests === null) {
    return (
      <div role="status" aria-label="Loading requests" className="min-h-0 flex-1 pt-4">
        <Skeleton className="my-4 h-[21px] w-32" />
        {[0, 1].map((index) => (
          <Skeleton key={index} className="mb-2 h-[76px] rounded-[8px]" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-16 text-center">
        <p className="text-[17px] leading-[22.1px] font-medium text-[rgb(246_246_246)]">No requests yet</p>
        <p className="mt-2 text-[14px] leading-[18.2px] text-[rgb(255_255_255/0.6)]">
          Start a request to download your data.
        </p>
      </div>
    );
  }

  const { active, past } = splitDataExports(requests);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-6">
      <h2 className={HEADING}>Active requests</h2>
      <div className="flex flex-col gap-2">
        {active.map((request) => (
          <RequestCard key={request.id} request={request}>
            {request.status === "PROCESSING" ? (
              <button
                type="button"
                onClick={() => setCanceling(request)}
                className={cn(PILL, "bg-[rgb(255_255_255/0.13)] text-[rgb(246_246_246)] hover:bg-[rgb(255_255_255/0.2)]")}
              >
                Cancel
              </button>
            ) : (
              <DownloadButton id={request.id} onStale={onStale} />
            )}
          </RequestCard>
        ))}
      </div>

      <h2 className={HEADING}>Past requests</h2>
      <div className="flex flex-col gap-2">
        {past.map((request) => (
          <RequestCard key={request.id} request={request}>
            <span className="text-[15px] leading-[19px] font-medium text-[rgb(255_255_255/0.5)]">
              {pastStatusLabel(request.status)}
            </span>
          </RequestCard>
        ))}
      </div>

      {canceling && (
        <CancelRequestDialog
          onKeep={() => setCanceling(null)}
          onDelete={async () => {
            try {
              await onCancel(canceling.id);
            } catch (cause) {
              toast.error(messageFor(cause));
            }
            setCanceling(null);
          }}
        />
      )}
    </div>
  );
}

function RequestCard({
  request,
  children,
}: {
  request: DataExportResponse;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-[8px] bg-[#2c2c2c] pr-4">
      <div className="min-w-0 pb-3">
        <p className="px-4 pt-4 pb-1.5 text-[16px] leading-[20.8px] font-medium text-[rgb(255_255_255/0.9)]">
          {requestedOnLabel(request.requestedAt)}
        </p>
        <p className="px-4 text-[13px] leading-[16.9px] text-[rgb(255_255_255/0.6)]">
          {requestScopeLabel(request)}
        </p>
      </div>
      {children}
    </div>
  );
}

/** A fresh signed link on every click: one lasts minutes, the file four days. */
function DownloadButton({ id, onStale }: { id: string; onStale: () => void }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const { url } = await getDataExportDownloadUrl(id);
      window.location.assign(url);
    } catch (cause) {
      toast.error(messageFor(cause));
      onStale();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className={cn(PILL, "bg-[var(--tt-red)] text-white enabled:hover:bg-[var(--tt-red-hover)]")}
    >
      Download
    </button>
  );
}

/**
 * The live confirm, inside the panel rather than over the page: a 280-wide
 * #3A3A3A card, radius 12; title 20/25/700 `.9` and body 15/19.5 `.75`,
 * centred, `padding: 24px 20px 20px` with 12 between; two 140 × 48 buttons
 * at 16/20.8 — "Keep request" `.75`, "Delete request" 500 in rgb(255, 76, 58).
 */
function CancelRequestDialog({
  onKeep,
  onDelete,
}: {
  onKeep: () => void;
  onDelete: () => Promise<void>;
}) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onKeep, !busy);
  useFocusTrap(dialogRef, true);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <button
        type="button"
        aria-label="Keep request"
        onClick={onKeep}
        className="absolute inset-0 cursor-default bg-black/[0.68]"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-[280px] overflow-hidden rounded-[12px] bg-[#3a3a3a] text-center"
      >
        <div className="px-5 pt-6 pb-5">
          <h3 id={titleId} className="mb-3 text-[20px] leading-[25px] font-bold text-[rgb(255_255_255/0.9)]">
            Delete your request?
          </h3>
          <p className="text-[15px] leading-[19.5px] text-[rgb(255_255_255/0.75)]">
            This request will be canceled and you won&rsquo;t receive a file. You can request a new file at
            any time.
          </p>
        </div>
        <div className="flex border-t-[0.5px] border-[rgb(255_255_255/0.2)]">
          <button
            type="button"
            onClick={onKeep}
            className="h-12 flex-1 border-r-[0.5px] border-[rgb(255_255_255/0.2)] px-2 text-[16px] leading-[20.8px] text-[rgb(255_255_255/0.75)]"
          >
            Keep request
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onDelete();
            }}
            className="h-12 flex-1 px-2 text-[16px] leading-[20.8px] font-medium text-[rgb(255_76_58)] disabled:opacity-60"
          >
            Delete request
          </button>
        </div>
      </div>
    </div>
  );
}
