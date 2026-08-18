/** Read one value out of a response body (Live value, ADR 0017). */
export interface ReadValue {
  raw: string;
  number: number | null;
}

/** "main.temp", "data[0].price", "[2].x", "a.b[1][0]" */
export function readJsonPath(json: unknown, path: string): unknown {
  const parts: (string | number)[] = [];
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path.trim()))) parts.push(m[1] !== undefined ? m[1] : Number(m[2]));
  let cur: unknown = json;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string | number, unknown>)[p];
  }
  return cur;
}

export function extractValue(body: string, mode: "json" | "regex", path: string): ReadValue {
  let raw: string;
  if (mode === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error("Response is not JSON");
    }
    const v = path.trim() === "" ? parsed : readJsonPath(parsed, path);
    if (v === undefined) throw new Error(`Nothing at "${path}"`);
    raw = typeof v === "object" ? JSON.stringify(v) : String(v);
  } else {
    let re: RegExp;
    try {
      re = new RegExp(path, "s");
    } catch {
      throw new Error("Invalid regex");
    }
    const m = re.exec(body);
    if (!m) throw new Error("Regex did not match");
    raw = (m[1] ?? m[0]).trim();
  }
  const n = Number(raw.replace(/,/g, ""));
  return { raw, number: raw !== "" && Number.isFinite(n) ? n : null };
}

export function formatValue(v: ReadValue, opts: { decimals?: number | null; prefix?: string; unit?: string }): string {
  const core = v.number !== null && opts.decimals !== null && opts.decimals !== undefined ? v.number.toFixed(opts.decimals) : v.number !== null ? String(v.number) : v.raw;
  return `${opts.prefix ?? ""}${core}${opts.unit ? ` ${opts.unit}` : ""}`.trim();
}
