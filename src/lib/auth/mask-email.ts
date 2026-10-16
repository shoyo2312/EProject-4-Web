/**
 * "Your code was sent to ba********@gmail.com" — the live modal keeps the first
 * two characters of the mailbox and a fixed run of eight stars, so the mask
 * says nothing about how long the address is. Anything without an "@" (a
 * username typed at login) is returned untouched.
 */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at <= 0) return address;
  return `${address.slice(0, Math.min(2, at))}********${address.slice(at)}`;
}
