/**
 * TikTok wordmark — note/music glyph plus "TikTok" in the brand weight.
 *
 * The live mark is 118×42 in the auth header and 118×32 in the sidebar; both
 * are the same artwork, so the caller sizes it and this stays one source of
 * truth. The lettering is `<text>` rather than outlines: the real wordmark is
 * set in TikTok's proprietary webfont, which is not redistributable.
 */
export function TikTokWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 118 32"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.88 12.42v-1.2a9.28 9.28 0 0 0-1.26-.09A9.3 9.3 0 0 0 3.4 27.98a9.27 9.27 0 0 1 6.48-15.56Z" />
      <path d="M10.1 25.86a4.24 4.24 0 0 0 4.23-4.09V1.4h3.7A7.03 7.03 0 0 1 17.9 0h-5.05v20.36a4.24 4.24 0 0 1-6.16 3.66 4.23 4.23 0 0 0 3.4 1.84Z" />
      <path d="M24.9 8.48V7.34a6.98 6.98 0 0 1-3.84-1.14 7.02 7.02 0 0 0 3.84 2.28Z" />
      <path d="M21.06 6.2A7 7 0 0 1 19.3 1.4h-1.36a7.04 7.04 0 0 0 3.11 4.8Z" />
      <path d="M12.85 18.3a4.24 4.24 0 0 0-1.97 8 4.24 4.24 0 0 1 3.45-6.7c.43 0 .85.07 1.25.2v-5.15a9.3 9.3 0 0 0-1.25-.09h-.22v3.92a4.3 4.3 0 0 0-1.26-.18Z" />
      <path d="M24.9 8.48v3.9a12.02 12.02 0 0 1-7.04-2.27v10.3a9.3 9.3 0 0 1-14.46 7.7A9.28 9.28 0 0 0 19.3 21.7V11.44a12.02 12.02 0 0 0 7.05 2.26V8.63c-.49 0-.97-.05-1.44-.15Z" />
      <path d="M17.86 20.41V10.1a12.02 12.02 0 0 0 7.04 2.27v-3.9a7.02 7.02 0 0 1-3.84-2.28 7.04 7.04 0 0 1-3.11-4.8h-3.7v20.38a4.24 4.24 0 0 1-7.64 2.35 4.24 4.24 0 0 1 1.97-8c.43 0 .85.06 1.26.18v-3.92a9.27 9.27 0 0 0-6.48 15.56 9.3 9.3 0 0 0 14.5-7.53Z" />
      <text
        x="34"
        y="23"
        fontFamily="inherit"
        fontSize="21"
        fontWeight="700"
        fill="currentColor"
      >
        TikTok
      </text>
    </svg>
  );
}
