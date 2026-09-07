import DOMPurify from "dompurify";

/**
 * A Message's HTML made safe for the reading frame (ADR 0051): scripts,
 * forms and event handlers stripped; every link opens outside the frame.
 * Remote images are not removed here — the frame's CSP blocks them until
 * the reader asks (`allowImages`), so a newsletter's tracking pixels never
 * fire on open.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "meta", "link", "base"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "formaction"],
    ADD_ATTR: ["target"],
    WHOLE_DOCUMENT: false,
  });
}

/** The document the sandboxed frame shows: our CSP and base styles around the sanitised body. */
export function frameDocument(body: string, opts: { allowImages: boolean; dark: boolean }): string {
  const img = opts.allowImages ? "img-src https: http: data: cid:" : "img-src data:";
  const csp = `default-src 'none'; ${img}; style-src 'unsafe-inline'; font-src https: data:`;
  const fg = opts.dark ? "#e5e5e5" : "#111";
  const bg = opts.dark ? "#141414" : "#fff";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>
:root{color-scheme:${opts.dark ? "dark" : "light"}}
body{margin:0;padding:12px 16px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${fg};background:${bg};word-wrap:break-word;overflow-wrap:anywhere}
img{max-width:100%;height:auto}
a{color:#2563eb}
pre{white-space:pre-wrap}
blockquote{border-left:3px solid #8884;margin:0;padding-left:12px;color:#888}
table{max-width:100%}
</style></head><body>${body}</body></html>`;
}

/** Plain text shown as-is, with links made clickable. */
export function textToHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linked = esc.replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${u}</a>`);
  return `<pre style="font:inherit">${linked}</pre>`;
}
