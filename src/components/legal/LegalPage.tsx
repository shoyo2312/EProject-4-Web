import Link from "next/link";

import { LEGAL_LAST_UPDATED, LEGAL_LINKS } from "@/lib/legal";

/**
 * The frame shared by /terms, /privacy and /data-deletion. They live outside
 * the `(shell)` group, so this `<main>` has to scroll on its own inside the
 * root layout's fixed-height row, and clear the fixed top bar.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="h-screen flex-1 overflow-y-auto px-5 pb-20 pt-20">
      <article className="mx-auto max-w-[720px] text-[15px] leading-[1.65] text-[var(--tt-text-secondary)]">
        <Link href="/" className="text-sm font-bold text-[var(--tt-red)] hover:underline">
          ← Nowa
        </Link>
        <h1 className="mt-4 text-[32px] font-bold leading-tight text-[var(--tt-text-display)]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[var(--tt-text-muted)]">
          Last updated: {LEGAL_LAST_UPDATED}
        </p>

        <div className="mt-8 flex flex-col gap-8">{children}</div>

        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--tt-divider)] pt-6 text-sm text-[var(--tt-text-muted)]">
          <Link href={LEGAL_LINKS.terms} className="hover:text-[var(--tt-text)]">
            Terms of Service
          </Link>
          <Link href={LEGAL_LINKS.privacy} className="hover:text-[var(--tt-text)]">
            Privacy Policy
          </Link>
          <Link href={LEGAL_LINKS.dataDeletion} className="hover:text-[var(--tt-text)]">
            Data Deletion
          </Link>
        </nav>
      </article>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-[var(--tt-text-display)]">{heading}</h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

export function SupportEmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="font-bold text-[var(--tt-text)] underline">
      {email}
    </a>
  );
}
