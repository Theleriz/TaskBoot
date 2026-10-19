// F-89: only http(s) addresses with a host are accepted; https:// is added when the scheme is missing.
// Returns the normalized URL or null.
export function normalizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname || (!url.hostname.includes('.') && url.hostname !== 'localhost')) return null;
  return url.href;
}
