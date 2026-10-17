import type { SocialProvider } from "@/lib/auth/social";

/**
 * How the owner proves it is them before closing the account, chosen the way
 * auth-service accepts it: the password when there is one, else a code to a
 * verified address, else a fresh sign-in with a linked provider.
 */
export type ClosureProof =
  | { kind: "password" }
  | { kind: "code"; email: string }
  | { kind: "provider"; provider: SocialProvider }
  | { kind: "none" };

export interface ClosableAccount {
  hasPassword: boolean;
  email: string | null;
  emailVerified: boolean;
  providers: readonly SocialProvider[];
}

export function closureProofFor(account: ClosableAccount): ClosureProof {
  if (account.hasPassword) return { kind: "password" };
  if (account.email && account.emailVerified) return { kind: "code", email: account.email };
  const provider = account.providers[0];
  return provider ? { kind: "provider", provider } : { kind: "none" };
}

/** auth-service names them `GOOGLE` / `FACEBOOK`; anything else is a provider this app has no button for. */
export function linkedProviders(raw: readonly string[] | undefined): SocialProvider[] {
  const known: SocialProvider[] = [];
  for (const name of raw ?? []) {
    const provider = name.toLowerCase();
    if ((provider === "google" || provider === "facebook") && !known.includes(provider)) {
      known.push(provider);
    }
  }
  return known;
}

/** What closing costs, as each choice is offered. The grace period is auth-service's. */
export const DELETION_GRACE_DAYS = 30;
