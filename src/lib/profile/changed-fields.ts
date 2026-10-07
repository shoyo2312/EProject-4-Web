/** The Edit profile form's text fields. */
export interface ProfileText {
  username: string;
  nickname: string;
  bio: string;
}

/**
 * The text fields `draft` changes from `current`, as the trimmed values to
 * save — empty when there is nothing to send.
 *
 * Both sides are trimmed. A name stored with a stray space (the form used to
 * send its input untrimmed) is the same name when it comes back trimmed, and
 * sending it would count as a rename: the nickname's week spent, or a bio-only
 * save refused while that week runs. Likewise a draft that only gained a space
 * changes nothing, so it must not enable Save.
 */
export function changedProfileFields(
  draft: ProfileText,
  current: ProfileText,
): Partial<ProfileText> {
  const changes: Partial<ProfileText> = {};
  for (const field of ["username", "nickname", "bio"] as const) {
    const next = draft[field].trim();
    if (next !== current[field].trim()) changes[field] = next;
  }
  return changes;
}
