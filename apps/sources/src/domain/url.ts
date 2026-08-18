/**
 * Embed URLs are absolute http(s) only — never javascript:, file:, data:.
 * A bare host ("grafana.local/d/abc") is taken as https. Returns null when
 * the input can't be an embeddable URL.
 */
export function normalizeEmbedUrl(raw: string): string | null {
  let t = raw.trim();
  if (!t) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = "https://" + t;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;
  return u.toString();
}

/** "https://grafana.example.com/d/abc?x=1" → "grafana.example.com" */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
