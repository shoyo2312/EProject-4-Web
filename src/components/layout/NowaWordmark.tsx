import Image from "next/image";

/**
 * Nowa wordmark — the app icon beside "Nowa" in the brand weight.
 *
 * It is 118×42 in the auth header and 118×32 in the sidebar; both are the same
 * artwork, so the caller sizes it and this stays one source of truth. The
 * lettering is live text rather than outlines, which keeps it sharp at both
 * sizes and inherits the caller's colour.
 */
export function NowaWordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Image
        src="/images/brand/nowa-icon.png"
        alt=""
        width={171}
        height={183}
        priority
        className="h-full w-auto rounded-[6px]"
      />
      <span className="text-[21px] leading-none font-bold tracking-tight">
        Nowa
      </span>
    </span>
  );
}
