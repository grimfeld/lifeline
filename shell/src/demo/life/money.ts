import { clampedDate, parts, patchDocument, startOfWeek, type DateStr } from "@lifeline/core";
import { addAccount, addCategory, addTransaction } from "@lifeline/app-ledger/src/data/repo";
import { addAllowance } from "@lifeline/app-pocket/src/data/repo";
import { addStorage } from "@lifeline/app-pantry/src/data/repo";
import { addAisle } from "@lifeline/app-shopping/src/data/repo";
import { PEOPLE, PLACES, type LifeClock } from "../persona";
import { run } from "./act";

/**
 * The money and household slice of the Demo life (#113): Iris's Ledger,
 * her Pocket allowances, what is in the flat's cupboards, the shopping list
 * on the fridge, and what the milk cost where. In euros, in Cork.
 *
 * Everything is dated from the visit day. Monthly bills fall on a fixed day
 * of the month — the last three such days up to the visit day — so the Ledger
 * reads them as Recurring series and forecasts the next one; everyday spending
 * sits at offsets of a few days. The counts never depend on the visit day, so
 * the balances do not either.
 *
 * There is no Command for Accounts, Categories, Allowances, Storages or
 * Aisles; those go through their App's own repo, the rest through Commands.
 */
export async function seedMoney(c: LifeClock): Promise<void> {
  const prices = await seedPrices(c);
  await seedLedger(c, prices);
  await seedPocket(c);
  await seedPantry(c);
  await seedShopping(c);
}

/** The last `n` days of the month falling on `dayOfMonth`, up to and including `today`, oldest first. */
function lastMonthly(today: DateStr, dayOfMonth: number, n: number): DateStr[] {
  let { y, m } = parts(today);
  if (parts(today).day < dayOfMonth) [y, m] = m === 1 ? [y - 1, 12] : [y, m - 1];
  const out: DateStr[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(clampedDate(y, m, dayOfMonth));
    [y, m] = m === 1 ? [y - 1, 12] : [y, m - 1];
  }
  return out;
}

// ---- Prices ----

interface Receipt {
  shop: string;
  offset: number;
  lines: { product: string; label: string; price: number; amount?: number; promo?: boolean }[];
}

/** The weekly shop, itemised. Each Receipt's total is paid on the Credit card the same day (see the Ledger). */
const RECEIPTS: Receipt[] = [
  { shop: "Tesco", offset: -40, lines: [
    { product: "Semi-skimmed milk", label: "TESCO SEMI SKIM 2L", price: 1.89, amount: 2 },
    { product: "Porridge oats", label: "FLAHAVANS OATS 1KG", price: 2.79, amount: 1 },
    { product: "Bananas", label: "BANANAS LOOSE", price: 1.12, amount: 0.84 },
    { product: "Free-range eggs", label: "FREE RANGE EGGS 12PK", price: 4.29, amount: 12 },
    { product: "Coffee beans", label: "FAIRTRADE BEANS 500G", price: 7.49, amount: 0.5 },
    { product: "Chicken thighs", label: "CHICKEN THIGHS 1KG", price: 6.5, amount: 1 },
    { product: "Chopped tomatoes", label: "CHOPPED TOMS 400G", price: 2.37, amount: 3 },
    { product: "Greek yoghurt", label: "GREEK STYLE YOG 500G", price: 1.85, amount: 1 },
    { product: "Spinach", label: "BABY SPINACH 200G", price: 1.79, amount: 1 },
  ] },
  { shop: "Lidl", offset: -33, lines: [
    { product: "Semi-skimmed milk", label: "MILBONA SEMI SKIMMED", price: 1.69, amount: 2 },
    { product: "Bananas", label: "BANANAS", price: 0.98, amount: 0.92 },
    { product: "Cheddar", label: "MATURE WHITE CHEDDAR", price: 3.29, amount: 0.4 },
    { product: "Sourdough loaf", label: "SOURDOUGH BLOOMER", price: 2.49, amount: 1 },
    { product: "Chopped tomatoes", label: "CHOPPED TOMATOES", price: 1.47, amount: 3 },
    { product: "Basmati rice", label: "BASMATI RICE 1KG", price: 1.89, amount: 1 },
    { product: "Greek yoghurt", label: "GREEK STYLE YOGURT", price: 1.29, amount: 1 },
    { product: "Chicken thighs", label: "CHICKEN THIGH FILLETS", price: 4.49, amount: 0.75 },
  ] },
  { shop: "Tesco", offset: -26, lines: [
    { product: "Semi-skimmed milk", label: "TESCO SEMI SKIM 2L", price: 1.95, amount: 2 },
    { product: "Oat milk", label: "OAT DRINK BARISTA 1L", price: 2.35, amount: 1 },
    { product: "Free-range eggs", label: "FREE RANGE EGGS 12PK", price: 4.29, amount: 12 },
    { product: "Cheddar", label: "TESCO MATURE CHEDDAR", price: 3.99, amount: 0.4, promo: true },
    { product: "Spinach", label: "BABY SPINACH 200G", price: 1.79, amount: 1 },
    { product: "Bananas", label: "BANANAS LOOSE", price: 1.15, amount: 0.88 },
    { product: "Basmati rice", label: "TESCO BASMATI 1KG", price: 2.6, amount: 1 },
  ] },
  { shop: "English Market", offset: -20, lines: [
    { product: "Sourdough loaf", label: "Sourdough", price: 5.2, amount: 1 },
    { product: "Free-range eggs", label: "Half dozen eggs", price: 2.8, amount: 6 },
    { product: "Cheddar", label: "Hegarty's cheddar", price: 6.4, amount: 0.25 },
  ] },
  { shop: "Lidl", offset: -18, lines: [
    { product: "Semi-skimmed milk", label: "MILBONA SEMI SKIMMED", price: 1.72, amount: 2 },
    { product: "Porridge oats", label: "CRUSTI CROC OATS 1KG", price: 1.49, amount: 1 },
    { product: "Bananas", label: "BANANAS", price: 1.05, amount: 0.95 },
    { product: "Oat milk", label: "VEMONDO OAT DRINK", price: 1.59, amount: 1 },
    { product: "Chicken thighs", label: "CHICKEN THIGH FILLETS", price: 4.59, amount: 0.75 },
    { product: "Spinach", label: "BABY SPINACH", price: 1.15, amount: 1 },
    { product: "Free-range eggs", label: "FREE RANGE EGGS 10", price: 2.89, amount: 10 },
  ] },
  { shop: "Tesco", offset: -12, lines: [
    { product: "Semi-skimmed milk", label: "TESCO SEMI SKIM 2L", price: 1.99, amount: 2 },
    { product: "Bananas", label: "BANANAS LOOSE", price: 1.18, amount: 0.86 },
    { product: "Coffee beans", label: "FAIRTRADE BEANS 500G", price: 5.99, amount: 0.5, promo: true },
    { product: "Sourdough loaf", label: "TESCO SOURDOUGH", price: 2.85, amount: 1 },
    { product: "Chicken thighs", label: "CHICKEN THIGHS 1KG", price: 6.75, amount: 1 },
    { product: "Greek yoghurt", label: "GREEK STYLE YOG 500G", price: 1.85, amount: 1 },
    { product: "Chopped tomatoes", label: "CHOPPED TOMS 400G", price: 1.58, amount: 2 },
  ] },
  { shop: "SuperValu", offset: -7, lines: [
    { product: "Semi-skimmed milk", label: "SV SEMI SKIMMED 2L", price: 2.09, amount: 2 },
    { product: "Free-range eggs", label: "FREE RANGE EGGS 6", price: 2.49, amount: 6 },
    { product: "Oat milk", label: "OAT DRINK 1L", price: 2.29, amount: 1 },
    { product: "Bananas", label: "BANANAS LOOSE", price: 1.24, amount: 0.8 },
    { product: "Spinach", label: "SV BABY SPINACH", price: 1.99, amount: 1 },
  ] },
  { shop: "Lidl", offset: -4, lines: [
    { product: "Semi-skimmed milk", label: "MILBONA SEMI SKIMMED", price: 1.75, amount: 2 },
    { product: "Bananas", label: "BANANAS", price: 1.02, amount: 0.9 },
    { product: "Cheddar", label: "MATURE WHITE CHEDDAR", price: 3.39, amount: 0.4 },
    { product: "Porridge oats", label: "CRUSTI CROC OATS 1KG", price: 1.49, amount: 1 },
    { product: "Chopped tomatoes", label: "CHOPPED TOMATOES", price: 1.53, amount: 3 },
    { product: "Chicken thighs", label: "CHICKEN THIGH FILLETS", price: 4.69, amount: 0.75 },
    { product: "Greek yoghurt", label: "GREEK STYLE YOGURT", price: 1.35, amount: 1 },
    { product: "Oat milk", label: "VEMONDO OAT DRINK", price: 1.65, amount: 1 },
  ] },
];

const PRODUCTS: [string, "mass" | "volume" | "count"][] = [
  ["Semi-skimmed milk", "volume"],
  ["Oat milk", "volume"],
  ["Porridge oats", "mass"],
  ["Bananas", "mass"],
  ["Cheddar", "mass"],
  ["Coffee beans", "mass"],
  ["Free-range eggs", "count"],
  ["Sourdough loaf", "count"],
  ["Chicken thighs", "mass"],
  ["Chopped tomatoes", "count"],
  ["Greek yoghurt", "count"],
  ["Spinach", "count"],
  ["Basmati rice", "mass"],
];

/** Shops, Products, the itemised Receipts and a few shelf prices noted in passing. Returns each Receipt's total in cents. */
async function seedPrices(c: LifeClock): Promise<{ shop: string; date: DateStr; cents: number }[]> {
  const shops: Record<string, string> = {};
  for (const name of ["Tesco", "Lidl", "SuperValu", "English Market"]) shops[name] = (await run("prices.shop-add", { name }))!;
  const products: Record<string, string> = {};
  for (const [name, dimension] of PRODUCTS) products[name] = (await run("prices.product-add", { name, dimension }))!;

  const totals: { shop: string; date: DateStr; cents: number }[] = [];
  for (const r of RECEIPTS) {
    const cents = r.lines.reduce((s, l) => s + Math.round(l.price * 100), 0);
    await run("prices.receipt", {
      shop: shops[r.shop],
      date: c.day(r.offset),
      total: cents / 100,
      lines: r.lines.map((l) => ({ label: l.label, price: l.price, amount: l.amount ?? 1, promo: !!l.promo, product: products[l.product] })),
    });
    totals.push({ shop: r.shop, date: c.day(r.offset), cents });
  }

  // Shelf prices, noted while not buying.
  const shelf = (product: string, shop: string, price: number, amount: number, offset: number, promo = false) =>
    run("prices.add", { product: products[product], shop: shops[shop], price, amount, promo, date: c.day(offset) });
  await shelf("Coffee beans", "SuperValu", 8.25, 0.5, -15);
  await shelf("Oat milk", "Tesco", 2.45, 1, -2);
  await shelf("Porridge oats", "SuperValu", 3.15, 1, -7);
  await shelf("Semi-skimmed milk", "English Market", 1.6, 1, -1);
  return totals;
}

// ---- Ledger ----

async function seedLedger(c: LifeClock, groceries: { shop: string; date: DateStr; cents: number }[]): Promise<void> {
  const current = await addAccount({ title: "Current account", flavor: "checking", openingBalance: 1_842_35 });
  const savings = await addAccount({ title: "Savings", flavor: "savings", openingBalance: 6_150_00 });
  const card = await addAccount({ title: "Credit card", flavor: "credit", openingBalance: -312_40 });

  const cat: Record<string, string> = {};
  const category = async (title: string, group: string, target: number, kind: "expense" | "income" = "expense", accumulating = false) => {
    cat[title] = await addCategory({ title, kind, group, target: target * 100, accumulating });
  };
  await category("Salary", "Income", 0, "income");
  await category("Side work", "Income", 0, "income");
  await category("Rent", "Home", 1350);
  await category("Utilities", "Home", 120);
  // A little over the two bills, as people budget a fixed bill.
  await category("Phone & internet", "Home", 75);
  await category("Groceries", "Food", 380);
  await category("Eating out", "Food", 150);
  await category("Transport", "Getting around", 60);
  await category("Climbing & sport", "Me", 80);
  await category("Subscriptions", "Me", 25);
  await category("Gifts", "Me", 50);
  await category("Holiday fund", "Saving up", 200, "expense", true);

  const spend = (account: string, category: string, payee: string, amount: number, date: DateStr, note?: string) =>
    run("ledger.add", { kind: "expense", account, category: cat[category], payee, amount, date, ...(note ? { note } : {}) });

  // Monthly: the salary, the bills, the gym. Three of each, so the Ledger sees a series.
  for (const d of lastMonthly(c.today, 25, 3))
    await run("ledger.add", { kind: "income", account: current, category: cat.Salary, payee: PLACES.clinic.name, amount: 3_085.4, date: d });
  for (const [offset, amount, note] of [[-31, 90, "Two sports massages"], [-16, 180, "Rugby club pre-season screening"], [-2, 60, "Sports massage"]] as const)
    await run("ledger.add", { kind: "income", account: current, category: cat["Side work"], payee: "Private clients", amount, date: c.day(offset), note });
  // The rent goes out the day after payday, with the standing order.
  for (const d of lastMonthly(c.today, 26, 3)) await spend(current, "Rent", "Ballintemple Lettings", 1_350, d);
  const power = [84.12, 79.6, 91.35];
  for (const [i, d] of lastMonthly(c.today, 14, 3).entries()) await spend(current, "Utilities", "Lee Valley Energy", power[i], d);
  for (const d of lastMonthly(c.today, 8, 3)) await spend(current, "Phone & internet", "Wavelink Mobile", 25, d);
  for (const d of lastMonthly(c.today, 18, 3)) await spend(current, "Phone & internet", "Rebel City Fibre", 45, d);
  for (const d of lastMonthly(c.today, 5, 3)) await spend(current, "Climbing & sport", PLACES.crag.name, 55, d, "Monthly membership");
  for (const d of lastMonthly(c.today, 3, 3)) await spend(card, "Subscriptions", "Streamline Music", 10.99, d);
  for (const d of lastMonthly(c.today, 11, 3)) await spend(card, "Subscriptions", "The Corkman Weekly", 6.5, d, "Digital subscription");

  // Paying herself first, the day after payday.
  for (const d of lastMonthly(c.today, 26, 3))
    await addTransaction({ kind: "transfer", date: d, amount: 400_00, fromAccountId: current, toAccountId: savings, note: "Standing order" });
  // Last month's card bill, cleared from the current account.
  const [, payoff] = lastMonthly(c.today, 20, 2);
  await addTransaction({ kind: "transfer", date: payoff, amount: 312_40, fromAccountId: current, toAccountId: card, note: "Card bill" });

  // The weekly shop, on the card — the same Receipts the Prices App holds.
  for (const g of groceries) await spend(card, "Groceries", g.shop, g.cents / 100, g.date);
  await spend(card, "Groceries", "Tesco", 23.6, c.day(-36));
  await spend(current, "Groceries", "Centra", 8.45, c.day(-23));
  await spend(current, "Groceries", "Centra", 11.2, c.day(-9));
  await spend(card, "Groceries", "Lidl", 46.3, c.day(-1));

  // Everyday spending over the last six weeks.
  const { aoife, marcus, helen } = PEOPLE;
  const out = (payee: string, amount: number, offset: number, note?: string) => spend(card, "Eating out", payee, amount, c.day(offset), note);
  await out("Quay Coffee", 4.2, -38);
  await out("The Fennel Room", 38.5, -34, `Dinner with ${aoife.name.split(" ")[0]}`);
  await out("Harbour Noodle Bar", 16.9, -27);
  await out("Quay Coffee", 3.8, -22);
  await out("The Shandon Arms", 24.0, -16, `Pints after climbing with ${marcus.name.split(" ")[0]}`);
  await out("Quay Coffee", 4.2, -10);
  await out("Harbour Noodle Bar", 18.4, -5);
  await out("Quay Coffee", 7.6, -2, "Two flat whites");

  const travel = (payee: string, amount: number, offset: number, note?: string) => spend(current, "Transport", payee, amount, c.day(offset), note);
  await travel("Leap card top-up", 20, -39);
  await travel("Leap card top-up", 20, -27);
  await travel("Lee Cycle Repairs", 32.5, -19, "New brake pads");
  await travel("Leap card top-up", 20, -11);
  await travel("Cork City Cabs", 14.8, -6, "Home in the rain");

  await spend(card, "Climbing & sport", "Peak Outdoor", 64.95, c.day(-30), "Climbing shoes, resoled pair retired");
  await spend(current, "Climbing & sport", "Myrtleville Swim Club", 30, c.day(-21), "Season membership");
  await spend(card, "Gifts", "Lantern Books", 22.99, c.day(-13), `Birthday book for ${helen.name.split(" ")[0]}`);
  await spend(card, "Gifts", "Pottery Corner", 18, c.day(-3), `Housewarming mug for ${aoife.name.split(" ")[0]}`);
  await spend(savings, "Holiday fund", "Lisbon flights", 186.4, c.day(-17), "Two returns, July");
}

// ---- Pocket ----

type Period = "week" | "month";

const ALLOWANCES: { name: string; period: Period; amount: number; emoji: string; color: string }[] = [
  { name: "Eating out", period: "month", amount: 150, emoji: "🍜", color: "orange" },
  { name: "Coffee", period: "week", amount: 20, emoji: "☕", color: "yellow" },
  { name: "Fun", period: "month", amount: 100, emoji: "🎟️", color: "violet" },
];

/** Spends by days back from the visit day. */
const SPENDS: { allowance: string; amount: number; offset: number; label: string }[] = [
  { allowance: "Coffee", amount: 3.8, offset: 0, label: "Flat white" },
  { allowance: "Coffee", amount: 4.2, offset: -2, label: "Flat white and a scone" },
  { allowance: "Coffee", amount: 3.4, offset: -4, label: "Americano" },
  { allowance: "Coffee", amount: 3.8, offset: -6, label: "Flat white" },
  { allowance: "Coffee", amount: 4.5, offset: -8, label: "Market coffee" },
  { allowance: "Eating out", amount: 18.4, offset: -1, label: "Noodles after work" },
  { allowance: "Eating out", amount: 24, offset: -5, label: "Pints with Marcus" },
  { allowance: "Eating out", amount: 12.5, offset: -9, label: "Burrito" },
  { allowance: "Eating out", amount: 38.5, offset: -14, label: "Dinner with Aoife" },
  { allowance: "Eating out", amount: 9.9, offset: -20, label: "Fish and chips" },
  { allowance: "Fun", amount: 16, offset: -3, label: "Cinema" },
  { allowance: "Fun", amount: 22, offset: -11, label: "Gig at the Triskel" },
  { allowance: "Fun", amount: 12, offset: -24, label: "Bouldering guest pass" },
];

function periodStart(period: Period, d: DateStr): DateStr {
  if (period === "week") return startOfWeek(d);
  const { y, m } = parts(d);
  return clampedDate(y, m, 1);
}

/** The current Allowances, plus every earlier period a Spend lands in. */
async function seedPocket(c: LifeClock): Promise<void> {
  for (const a of ALLOWANCES) {
    const starts = new Set([periodStart(a.period, c.today)]);
    for (const s of SPENDS) if (s.allowance === a.name) starts.add(periodStart(a.period, c.day(s.offset)));
    for (const from of starts) await addAllowance({ name: a.name, period: a.period, from, amount: a.amount * 100, emoji: a.emoji, color: a.color });
  }
  for (const s of SPENDS) await run("pocket.spend", { allowance: s.allowance, amount: s.amount, date: c.day(s.offset), label: s.label });
}

// ---- Pantry ----

async function seedPantry(c: LifeClock): Promise<void> {
  const freezer = await addStorage("Freezer", "freezer");
  const fridge = await addStorage("Fridge", "fridge");
  const cupboard = await addStorage("Cupboard", "shelf");
  const add = (storage: string, title: string, args: Record<string, unknown>) => run("pantry.add", { title, storage, ...args });

  await add(cupboard, "Porridge oats", { quantity: 1, unit: "bags", minimum: 2 });
  await add(cupboard, "Basmati rice", { quantity: 2, unit: "kg", minimum: 1 });
  await add(cupboard, "Chickpeas", { quantity: 4, unit: "tins", minimum: 2 });
  await add(cupboard, "Chopped tomatoes", { quantity: 1, unit: "tins", minimum: 3 });
  await add(cupboard, "Coffee beans", { quantity: 1, unit: "bags", minimum: 1 });
  await add(cupboard, "Peanut butter", { quantity: 1, unit: "jars", expires: c.day(120) });
  await add(fridge, "Greek yoghurt", { quantity: 1, unit: "tubs", expires: c.day(2) });
  await add(fridge, "Spinach", { quantity: 1, unit: "bags", expires: c.day(1) });
  await add(fridge, "Cheddar", { quantity: 1, unit: "blocks", expires: c.day(18) });
  await add(fridge, "Free-range eggs", { quantity: 4, minimum: 6, expires: c.day(9) });
  await add(fridge, "Oat milk", { quantity: 0, unit: "cartons", minimum: 1 });
  await add(freezer, "Frozen peas", { quantity: 1, unit: "bags", frozenOn: c.day(-30) });
  await add(freezer, "Chicken thighs", { quantity: 2, unit: "packs", frozenOn: c.day(-12), expires: c.day(80) });
  await add(freezer, "Lentil soup", { quantity: 3, unit: "portions", frozenOn: c.day(-6) });
  await add(freezer, "Sourdough loaf", { quantity: 1, frozenOn: c.day(-19) });
}

// ---- Shopping ----

async function seedShopping(c: LifeClock): Promise<void> {
  const aisles: Record<string, string> = {};
  for (const title of ["Fruit & veg", "Dairy", "Bakery", "Cupboard", "Household"]) aisles[title] = await addAisle(title);
  const need = (title: string, aisle: string, note?: string) => run("shopping.add", { title, aisle: aisles[aisle], ...(note ? { note } : {}) });

  await need("Oat milk", "Dairy", "Barista one, two cartons");
  await need("Porridge oats", "Cupboard");
  await need("Chopped tomatoes", "Cupboard", "x3");
  await need("Lemons", "Fruit & veg");
  await need("Avocados", "Fruit & veg", "Ripe ones for Saturday");
  await need("Free-range eggs", "Dairy");
  await need("Wholemeal pittas", "Bakery");
  await need("Washing-up liquid", "Household");
  await need("Bin bags", "Household");

  // Bought this week.
  const bought: [string, string, number][] = [
    ["Bananas", "Fruit & veg", -4],
    ["Sourdough loaf", "Bakery", -2],
    ["Kitchen roll", "Household", -1],
  ];
  for (const [title, aisle, offset] of bought) {
    const id = await need(title, aisle);
    if (id) await patchDocument(id, { boughtOn: c.day(offset) });
  }
}
