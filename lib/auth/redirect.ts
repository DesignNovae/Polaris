/**
 * Post-authentication redirect validation.
 *
 * `redirect_url` is attacker-controlled: anyone can send a student a link to
 * `/signin?redirect_url=...`, and whatever survives this function is where the
 * browser goes once they have signed in. Get it wrong and the sign-in page
 * becomes an open redirect - a credible phishing primitive, because the victim
 * really did just authenticate on the real domain.
 *
 * This lived inline in five separate route files, each with the same check:
 *
 *     value.startsWith("/") && !value.startsWith("//")
 *
 * which is not sufficient. Browsers normalise a backslash to a forward slash in
 * the authority position, so `/\evil.com` passes that test and then navigates
 * to `//evil.com`. Leading control characters and tabs are also stripped by the
 * URL parser before it re-reads the authority, giving the same result.
 *
 * One implementation, allowlist-shaped: a destination must look like a
 * same-origin path and nothing else.
 */

/** Where to send someone when the requested destination is not usable. */
export const DEFAULT_DESTINATION = "/roadmap";

const MAX_LENGTH = 512;

/**
 * Control characters, space, and DEL are stripped or re-parsed by the URL
 * parser, so a value containing any of them cannot be trusted as written.
 * Checked by code point rather than a regex literal so the source file stays
 * pure ASCII.
 */
function hasUnsafeChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** `%2f` decodes to "/" and `%5c` to "\" - either yields a second slash. */
const ENCODED_SLASH_PREFIX = /^\/%(?:2f|5c)/i;

/**
 * True only for a plain, same-origin path.
 *
 * Rejects, in order: non-strings, empty values, anything over the length cap,
 * control characters and whitespace anywhere, backslashes anywhere, anything
 * not starting with a single `/`, protocol-relative `//`, and percent-encoded
 * slashes or backslashes in the leading segment.
 */
export function isSafeDestination(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.length > MAX_LENGTH) return false;
  if (hasUnsafeChars(value)) return false;
  if (value.includes("\\")) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (ENCODED_SLASH_PREFIX.test(value)) return false;
  return true;
}

/**
 * The destination to use, falling back to `fallback` when the request's value
 * is missing or unsafe. Accepts the raw `searchParams` shape, where a repeated
 * query parameter arrives as an array.
 */
export function safeDestination(
  value: string | string[] | undefined | null,
  fallback: string = DEFAULT_DESTINATION,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isSafeDestination(candidate) ? candidate : fallback;
}
