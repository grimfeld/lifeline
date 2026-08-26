import { describe, expect, it } from "vitest";
import type { Transaction } from "./types";
import { payeeCategoryIndex, suggestCategory } from "./suggest";
import { inferDateFormat, looksLikePaypal, matchPaypal, parsePaypalCsv, payeeOf, paypalIndex, PaypalFormatError } from "./paypal";

/** PayPal's English export, EU locale: comma decimals, day-first dates, a memo shadow row and a funding row. */
const CSV = `"Date","Time","TimeZone","Name","Type","Status","Currency","Gross","Fee","Net","Transaction ID","Reference Txn ID","Balance Impact"
"10/03/2026","12:04:11","CET","Spotify AB","Express Checkout Payment","Completed","EUR","-10,99","0,00","-10,99","8XY12345678901234","","Debit"
"10/03/2026","12:04:11","CET","PayPal","Bank Deposit to PP Account","Completed","EUR","10,99","0,00","10,99","9AB98765432109876","8XY12345678901234","Credit"
"11/03/2026","09:15:00","CET","Steam Games","Express Checkout Payment","Completed","EUR","-24,00","0,00","-24,00","7QQ11112222333344","","Debit"
"11/03/2026","09:15:00","CET","Steam Games","Express Checkout Payment","Completed","EUR","-24,00","0,00","-24,00","7QQ11112222333344","","Memo"
"12/03/2026","18:40:00","CET","Etsy Seller","Express Checkout Payment","Completed","EUR","-31,50","0,00","-31,50","6ZZ55556666777788","","Debit"
"12/03/2026","18:41:00","CET","Bandcamp","Express Checkout Payment","Completed","EUR","-31,50","0,00","-31,50","5YY99990000111122","","Debit"
`;

const entries = parsePaypalCsv(CSV);
const index = paypalIndex(entries);

describe("parsePaypalCsv", () => {
  it("reads the balance-affecting rows and drops PayPal's memo shadows", () => {
    expect(entries.map((e) => e.name)).toEqual(["Spotify AB", "PayPal", "Steam Games", "Etsy Seller", "Bandcamp"]);
    expect(entries[0]).toMatchObject({ date: "2026-03-10", amount: -1099, id: "8XY12345678901234", refId: "" });
    expect(entries[1]).toMatchObject({ amount: 1099, refId: "8XY12345678901234" });
  });

  it("reads localized headers", () => {
    const fr = `"Date","Nom","Type","Devise","Brut","Numéro de transaction","Numéro de transaction de référence","Impact sur le solde"
"10/03/2026","Spotify AB","Paiement","EUR","-10,99","8XY12345678901234","","Débit"`;
    const [row] = parsePaypalCsv(fr);
    expect(row).toMatchObject({ name: "Spotify AB", amount: -1099, date: "2026-03-10", id: "8XY12345678901234" });
  });

  it("reads the current French export: BOM, 'Avant commission', 'Numéro de la transaction de référence', a currency column", () => {
    const fr = `\ufeff"Date","Heure","Fuseau horaire","Nom","Type","État","Devise","Avant commission","Commission","Net","Numéro de transaction","Numéro de la transaction de référence","Objet","Impact sur le solde"
"09/01/2026","10:00:00","CET","Thangs 3D Inc.","Paiement d'abonnement","Terminé","USD","-12,32","0,00","-12,32","5LA35124KN7349003","I-L2US6SFEDGCB","Multi Maker","Débit"
"09/01/2026","10:00:00","CET","","Conversion de devise standard","Terminé","EUR","-11,02","0,00","-11,02","1CV00000000000001","5LA35124KN7349003","","Débit"
"09/01/2026","10:00:00","CET","","Conversion de devise standard","Terminé","USD","12,32","0,00","12,32","1CV00000000000002","5LA35124KN7349003","","Crédit"
"10/01/2026","11:00:00","CET","Uber Payments BV","Autorisation standard","Terminé","EUR","-11,02","0,00","-11,02","6XS431032C5678703","B-7YS17408W7013793D","","Mémo"
"12/01/2026","12:00:00","CET","www.steampowered.com","Paiement Express Checkout","Terminé","EUR","-12,32","0,00","-12,32","4BX48845SL310502X","","","Débit"`;
    const rows = parsePaypalCsv(fr);
    expect(rows.map((r) => [r.name || r.type, r.currency, r.amount])).toEqual([
      ["Thangs 3D Inc.", "USD", -1232],
      ["Conversion de devise standard", "EUR", -1102],
      ["Conversion de devise standard", "USD", 1232],
      ["www.steampowered.com", "EUR", -1232],
    ]);
    expect(rows[0].date).toBe("2026-01-09");
    expect(rows[1].refId).toBe("5LA35124KN7349003");

    const idx = paypalIndex(rows);
    // The euro conversion line borrows the dollar payment's merchant…
    expect(matchPaypal({ date: "2026-01-10", amount: -1102, text: "PAYPAL EUROPE S.A.R.L. ET CIE S.C.A" }, idx).pick?.payee).toBe("Thangs 3D Inc.");
    // …and the dollar figure itself is never matched against a euro bank row: 12,32 € is Steam, not Thangs.
    const steam = matchPaypal({ date: "2026-01-12", amount: -1232, text: "PAYPAL EUROPE S.A.R.L. ET CIE S.C.A" }, idx);
    expect(steam.status).toBe("confident");
    expect(steam.pick?.payee).toBe("www.steampowered.com");
  });

  it("falls back to Net when the file has no Gross column", () => {
    const [row] = parsePaypalCsv('"Date","Name","Currency","Net","Transaction ID"\n"10/03/2026","Spotify AB","EUR","-10,99","8XY12345678901234"');
    expect(row).toMatchObject({ name: "Spotify AB", amount: -1099, currency: "EUR" });
  });

  it("refuses a file that is not a PayPal activity export", () => {
    expect(() => parsePaypalCsv('"Datum","Betrag"\n"10/03/2026","-10,99"')).toThrow(PaypalFormatError);
    expect(() => parsePaypalCsv('"Datum","Betrag"\n"10/03/2026","-10,99"')).toThrow(/no Gross, Name column/);
  });
});

describe("inferDateFormat", () => {
  it("reads the format off the whole column, day-first when ambiguous", () => {
    expect(inferDateFormat(["3/10/2026", "25/12/2026"])).toBe("DMY");
    expect(inferDateFormat(["3/10/2026", "12/25/2026"])).toBe("MDY");
    expect(inferDateFormat(["2026-03-10"])).toBe("YMD");
    expect(inferDateFormat(["3/10/2026"])).toBe("DMY");
  });
});

describe("looksLikePaypal", () => {
  it("catches how banks write it, and leaves everything else alone", () => {
    expect(looksLikePaypal("PAYPAL EUROPE S.A.R.L. ET CIE S.C.A")).toBe(true);
    expect(looksLikePaypal("PAY PAL 1035739024036")).toBe(true);
    expect(looksLikePaypal("PP*STEAM GAMES")).toBe(true);
    expect(looksLikePaypal("ALBERT HEIJN 1543")).toBe(false);
  });
});

describe("payeeOf", () => {
  it("borrows the merchant from the payment a funding row references", () => {
    expect(payeeOf(entries[1], index)).toBe("Spotify AB");
  });
});

describe("matchPaypal", () => {
  it("takes a reference the bank itself quoted", () => {
    const m = matchPaypal({ date: "2026-03-14", amount: -1099, text: "PAYPAL EUROPE SARL / REF 8XY12345678901234" }, index);
    expect(m.status).toBe("exact");
    expect(m.pick?.payee).toBe("Spotify AB");
  });

  it("matches on amount inside the posting window", () => {
    const m = matchPaypal({ date: "2026-03-12", amount: -2400, text: "PAYPAL" }, index);
    expect(m.status).toBe("confident");
    expect(m.pick?.payee).toBe("Steam Games");
  });

  it("counts a payment and its funding row as one merchant, not two", () => {
    const m = matchPaypal({ date: "2026-03-11", amount: -1099, text: "PAYPAL" }, index);
    expect(m.status).toBe("confident");
    expect(m.pick?.payee).toBe("Spotify AB");
  });

  it("asks rather than guesses when two merchants fit", () => {
    const m = matchPaypal({ date: "2026-03-13", amount: -3150, text: "PAYPAL" }, index);
    expect(m.status).toBe("ambiguous");
    expect(m.pick).toBeNull();
    expect(m.candidates.map((c) => c.payee).sort()).toEqual(["Bandcamp", "Etsy Seller"]);
  });

  it("says nothing when the amount or the day is outside the file", () => {
    expect(matchPaypal({ date: "2026-03-12", amount: -999, text: "PAYPAL" }, index).status).toBe("none");
    expect(matchPaypal({ date: "2026-04-20", amount: -2400, text: "PAYPAL" }, index).status).toBe("none");
    expect(matchPaypal({ date: "2026-03-08", amount: -2400, text: "PAYPAL" }, index).status).toBe("none");
  });
});

describe("the problem this solves", () => {
  function tx(partial: Partial<Transaction>): Transaction {
    return { id: Math.random().toString(36).slice(2), kind: "expense", accountId: "a", note: "", categoryId: "", payee: "", ...partial } as Transaction;
  }

  it("without resolution, one categorized PayPal row categorizes every PayPal row", () => {
    const history = [tx({ payee: "PAYPAL EUROPE S.A.R.L. ET CIE S.C.A", categoryId: "music", date: "2026-02-01" })];
    const index = payeeCategoryIndex(history);
    // The Steam purchase gets "music" purely because the bank calls both of them PayPal.
    expect(suggestCategory("PAYPAL EUROPE S.A.R.L. ET CIE S.C.A", "expense", index)?.categoryId).toBe("music");
  });

  it("with resolution, each merchant keeps its own category", () => {
    const history = [tx({ payee: "Spotify AB", categoryId: "music", date: "2026-02-01" }), tx({ payee: "Steam Games", categoryId: "games", date: "2026-02-01" })];
    const catIndex = payeeCategoryIndex(history);
    const bankRows = [
      { date: "2026-03-11", amount: -1099, text: "PAYPAL EUROPE S.A.R.L. ET CIE S.C.A" },
      { date: "2026-03-12", amount: -2400, text: "PAYPAL EUROPE S.A.R.L. ET CIE S.C.A" },
    ];
    const resolved = bankRows.map((r) => matchPaypal(r, index).pick?.payee ?? r.text);
    expect(resolved).toEqual(["Spotify AB", "Steam Games"]);
    expect(resolved.map((p) => suggestCategory(p, "expense", catIndex)?.categoryId)).toEqual(["music", "games"]);
  });
});
