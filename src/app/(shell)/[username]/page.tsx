import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileRouter } from "@/components/profile/ProfileRouter";

/**
 * A dynamic segment rather than a literal `@user` folder: in the App Router a
 * folder whose name starts with "@" is a parallel-route slot, not a path. The
 * URL segment arrives here with its "@" intact — `/@user` gives "@user".
 *
 * Which account answers is decided in the browser by `ProfileRouter`, because
 * it depends on the session — see the note there.
 */
type Params = { params: Promise<{ username: string }> };

// Profiles need a token to read, which the server does not have, so the title
// stays generic rather than attempting a fetch that would 401.
export const metadata: Metadata = { title: "Profile | Nowa" };

export default async function UserProfileRoute({ params }: Params) {
  const { username } = await params;

  // Only handles live at this depth. Anything without the "@" is a route that
  // does not exist rather than a creator whose name happens to match.
  if (!username.startsWith("@") && !username.startsWith("%40")) notFound();

  return (
    <ProfileRouter handle={decodeURIComponent(username).replace(/^@/, "")} />
  );
}
