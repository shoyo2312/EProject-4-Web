import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileRouter } from "@/components/profile/ProfileRouter";
import { isBackendHandle } from "@/lib/api/adapters";
import { getProfile } from "@/lib/data";

/**
 * A dynamic segment rather than a literal `@user` folder: in the App Router a
 * folder whose name starts with "@" is a parallel-route slot, not a path. The
 * URL segment arrives here with its "@" intact — `/@user` gives "@user".
 *
 * Which data source answers is decided in the browser by `ProfileRouter`,
 * because it depends on the session — see the note there.
 */
type Params = { params: Promise<{ username: string }> };

function stripHandle(segment: string): string {
  return decodeURIComponent(segment).replace(/^@/, "");
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const handle = stripHandle(username);

  // Backend profiles need a token to read, which the server does not have, so
  // their title stays generic rather than attempting a fetch that would 401.
  if (isBackendHandle(handle)) return { title: "Profile | TikTok" };

  const profile = await getProfile(handle);
  if (!profile) return { title: "Profile not found | TikTok" };

  return {
    title: `${profile.author.nickname} (@${profile.author.username}) | TikTok`,
    description: profile.bio || undefined,
  };
}

export default async function UserProfileRoute({ params }: Params) {
  const { username } = await params;

  // Only handles live at this depth. Anything without the "@" is a route that
  // does not exist rather than a creator whose name happens to match.
  if (!username.startsWith("@") && !username.startsWith("%40")) notFound();

  const handle = stripHandle(username);
  const mockProfile = isBackendHandle(handle) ? null : await getProfile(handle);

  return <ProfileRouter handle={handle} mockProfile={mockProfile} />;
}
