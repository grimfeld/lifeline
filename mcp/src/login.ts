/** The sign-in page an agent's client sends the person to (ADR 0062). Plain HTML: it must work in any browser, phone included. */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function loginPage(o: { request?: string; clientName?: string; redirectUri?: string; write?: boolean; email?: string; error?: string; expired?: boolean }): string {
  const host = o.redirectUri ? new URL(o.redirectUri).host : "";
  const body = o.expired
    ? `<h1>This sign-in expired</h1><p>Start connecting again from your app.</p>`
    : `<h1>Connect to Lifeline</h1>
      <p class="who"><strong>${esc(o.clientName || "An app")}</strong>${host ? ` <span>(${esc(host)})</span>` : ""} wants to use your Lifeline.</p>
      ${o.error ? `<p class="error" role="alert">${esc(o.error)}</p>` : ""}
      <form method="post" action="/oauth/login">
        <input type="hidden" name="request" value="${esc(o.request ?? "")}">
        <label>Email <input name="email" type="email" autocomplete="username" required value="${esc(o.email ?? "")}" autofocus></label>
        <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
        ${o.write ? `<label class="check"><input type="checkbox" name="allow_write" checked> Allow changes — create tasks and events, complete items, edit documents</label>` : ""}
        <p class="note">It will read your Documents and agenda. It never sees your Private folder, and cannot delete anything.</p>
        <button type="submit">Allow</button>
        <button type="submit" name="deny" value="1" formnovalidate class="secondary">Deny</button>
      </form>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to Lifeline</title>
<style>
  :root { color-scheme: light dark; --bg: #fafaf9; --fg: #1c1917; --muted: #78716c; --card: #fff; --line: #e7e5e4; --accent: #1c1917; --accent-fg: #fff; --err: #b91c1c; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0c0a09; --fg: #f5f5f4; --muted: #a8a29e; --card: #1c1917; --line: #292524; --accent: #f5f5f4; --accent-fg: #0c0a09; --err: #f87171; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; padding: 16px; }
  main { width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .who span, .note { color: var(--muted); }
  .note { font-size: 13px; }
  .error { color: var(--err); }
  label { display: block; margin: 12px 0; font-size: 14px; }
  input[type=email], input[type=password] { display: block; width: 100%; margin-top: 4px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: inherit; font: inherit; }
  .check { display: flex; gap: 8px; align-items: flex-start; }
  button { width: 100%; padding: 10px; margin-top: 8px; border: 0; border-radius: 8px; background: var(--accent); color: var(--accent-fg); font: inherit; font-weight: 600; cursor: pointer; }
  button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--line); font-weight: 400; }
</style></head>
<body><main>${body}</main></body></html>`;
}
