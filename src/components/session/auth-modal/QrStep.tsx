"use client";

import { QRCodeSVG } from "qrcode.react";

import { useQrLogin } from "@/hooks/use-qr-login";
import type { QrView } from "@/lib/auth/qr-login";

import { ModalTitle, PillButton } from "./ModalFields";

/**
 * "Log in with QR code": the signed-in Nowa app scans the code and the owner
 * confirms on the phone. The image carries only `nowa://qr-login?id=…`; the
 * poll token that collects the session never leaves this page.
 */
export function QrStep({ onApproved }: { onApproved: () => Promise<void> }) {
  const { view, refresh } = useQrLogin(onApproved);

  return (
    <>
      <ModalTitle className="mb-4">Log in with QR code</ModalTitle>

      <div className="mx-auto mb-6 flex h-[184px] w-[184px] items-center justify-center rounded-[12px] bg-white p-3">
        <CodeImage view={view} onRefresh={refresh} />
      </div>

      <Caption view={view} />
    </>
  );
}

function CodeImage({ view, onRefresh }: { view: QrView; onRefresh: () => void }) {
  if (view.phase === "loading") {
    return <span className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black" />;
  }
  if (view.phase === "showing") {
    return (
      <div className="relative">
        <QRCodeSVG
          value={view.code.qrContent}
          size={160}
          level="M"
          aria-label="QR code to log in with the Nowa app"
          className={view.scannedBy !== null ? "opacity-20" : undefined}
        />
        {view.scannedBy !== null && (
          <span className="absolute inset-0 flex items-center justify-center text-center text-[14px] leading-5 font-semibold text-black">
            Scanned
          </span>
        )}
      </div>
    );
  }
  if (view.phase === "approved") {
    return <span className="text-[14px] font-semibold text-black">Logging in…</span>;
  }

  const label =
    view.phase === "rejected"
      ? "Login declined"
      : view.phase === "error"
        ? "Couldn’t load"
        : "QR code expired";
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="text-[14px] leading-5 font-semibold text-black">{label}</span>
      <PillButton type="button" disabled={false} onClick={onRefresh} className="h-9 w-auto px-5 text-[14px]">
        Refresh
      </PillButton>
    </div>
  );
}

function Caption({ view }: { view: QrView }) {
  if (view.phase === "showing" && view.scannedBy !== null) {
    return (
      <p className="text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        {view.scannedBy ? (
          <>
            Scanned by <span className="font-semibold text-[var(--tt-text)]">@{view.scannedBy}</span>.{" "}
          </>
        ) : null}
        Confirm the login on your phone.
      </p>
    );
  }
  if (view.phase === "error") {
    return (
      <p role="alert" className="text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        {view.message}
      </p>
    );
  }
  return (
    <ol className="mx-auto w-[300px] max-w-full list-decimal space-y-1 pl-5 text-[14px] leading-5 text-[var(--tt-text-muted)]">
      <li>Open the Nowa app on your phone</li>
      <li>
        Go to <span className="font-semibold text-[var(--tt-text)]">Profile</span> and tap the scan icon
      </li>
      <li>Scan this code, then confirm the login on your phone</li>
    </ol>
  );
}
