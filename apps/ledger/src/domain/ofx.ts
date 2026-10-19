import type { DateStr } from "@lifeline/core";
import type { ImportRow } from "./csv";
import { parseAmount } from "./money";

/**
 * OFX import (ADR 0033): the self-describing bank format — no column
 * mapping, unambiguous dates, and a guaranteed-unique FITID that goes
 * straight into importId, so dedupe is exact instead of fingerprint-
 * probable. Handles both the SGML flavour (v1, unclosed tags) and the XML
 * flavour (v2); .qfx is the same thing with a Quicken header.
 */

/** Does this file look like OFX? (Header line or an <OFX> tag anywhere.) */
export function isOfx(text: string): boolean {
  const head = text.slice(0, 512);
  return /OFXHEADER\s*[:=]/i.test(head) || /<OFX>/i.test(text);
}

/** "20260310" / "20260310120000[+1:CET]" → "2026-03-10"; null when unreadable. */
export function parseOfxDate(raw: string): DateStr | null {
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** First <TAG>value of a block — SGML leaves tags unclosed, XML closes them; both stop at "<". */
function tagValue(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return m ? decodeEntities(m[1].trim()) : "";
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** One pass, so "&amp;lt;" reads as the text "&lt;", not as "<". */
function decodeEntities(s: string): string {
  return s.replace(/&(?:(amp|lt|gt|quot|apos)|#(\d+));/g, (_m, name: string | undefined, code: string | undefined) =>
    name ? NAMED_ENTITIES[name] : String.fromCharCode(Number(code)),
  );
}

/**
 * Every <STMTTRN> in the file as an ImportRow — the same shape the CSV path
 * produces, so preview, dedupe and posting are shared. Signed cents:
 * negative = expense, positive = income, exactly as OFX writes TRNAMT.
 */
export function parseOfx(text: string): ImportRow[] {
  // Split on <STMTTRN>; SGML never closes it, so cut each part at the next
  // closing tag when one exists (XML) and rely on tag names otherwise.
  const blocks = text
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((part) => part.split(/<\/STMTTRN>/i)[0]);
  return blocks.map((block, index) => {
    const date = parseOfxDate(tagValue(block, "DTPOSTED"));
    const amount = parseAmount(tagValue(block, "TRNAMT"));
    const name = tagValue(block, "NAME");
    const memo = tagValue(block, "MEMO");
    return {
      index,
      date,
      amount,
      // NAME is the payee; MEMO the free note — when only MEMO exists it is the better payee.
      payee: name || memo,
      note: name ? memo : "",
      importId: tagValue(block, "FITID"),
      invalid: date === null || amount === null || amount === 0,
      duplicateOf: null,
    };
  });
}
