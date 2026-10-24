import { describe, expect, it } from "vitest";
import { CROSSWORD_MAX, cellsOf, layoutCrossword, type Placed } from "./crossword";

const pool = (...words: string[]) => words.map((w) => Array.from(w));

/** Every cell the layout fills, with the letter each answer through it puts there. */
function grid(words: string[][], placed: Placed[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of placed) {
    cellsOf(p, words[p.index]!.length).forEach(([r, c], i) => {
      const k = `${r},${c}`;
      out.set(k, [...(out.get(k) ?? []), words[p.index]![i]!]);
    });
  }
  return out;
}

/** The grid drawn row by row, "." for an empty cell. */
function picture(words: string[][], placed: Placed[]): string[] {
  const g = grid(words, placed);
  const at = [...g.keys()].map((k) => k.split(",").map(Number) as [number, number]);
  const rows = Math.max(...at.map(([r]) => r)) + 1;
  const cols = Math.max(...at.map(([, c]) => c)) + 1;
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => g.get(`${r},${c}`)?.[0] ?? ".").join(""));
}

/** Answers joined through shared cells: one piece, or not. */
function connected(words: string[][], placed: Placed[]): boolean {
  const cells = placed.map((p) => new Set(cellsOf(p, words[p.index]!.length).map(([r, c]) => `${r},${c}`)));
  const seen = new Set([0]);
  const todo = [0];
  while (todo.length) {
    const i = todo.pop()!;
    cells.forEach((s, j) => {
      if (!seen.has(j) && [...s].some((k) => cells[i]!.has(k))) {
        seen.add(j);
        todo.push(j);
      }
    });
  }
  return seen.size === placed.length;
}

/** No two letters touch unless they belong to one answer or cross: what makes a crossword readable. */
function strayTouches(words: string[][], placed: Placed[]): string[] {
  const g = grid(words, placed);
  const owner = new Map<string, Set<number>>();
  for (const p of placed) for (const [r, c] of cellsOf(p, words[p.index]!.length)) owner.set(`${r},${c}`, (owner.get(`${r},${c}`) ?? new Set()).add(p.index));
  const bad: string[] = [];
  for (const k of g.keys()) {
    const [r, c] = k.split(",").map(Number) as [number, number];
    for (const n of [`${r + 1},${c}`, `${r},${c + 1}`]) {
      if (!g.has(n)) continue;
      const shared = [...owner.get(k)!].some((i) => owner.get(n)!.has(i));
      if (!shared) bad.push(`${k}|${n}`);
    }
  }
  return bad;
}

describe("layoutCrossword", () => {
  const words = pool("casa", "sol", "luna", "mesa", "agua", "nube", "perro", "gato", "arbol");

  it("places 5 to 8 answers, every one crossing into one grid, no cell given two letters", () => {
    const placed = layoutCrossword(words)!;
    expect(placed.length).toBeGreaterThanOrEqual(5);
    expect(placed.length).toBeLessThanOrEqual(CROSSWORD_MAX);
    for (const letters of grid(words, placed).values()) expect(new Set(letters).size).toBe(1);
    expect(connected(words, placed)).toBe(true);
    expect(strayTouches(words, placed)).toEqual([]);
    expect(new Set(placed.map((p) => p.index)).size).toBe(placed.length);
  });

  it("is the same layout for the same input, top-left at 0,0", () => {
    const placed = layoutCrossword(words)!;
    expect(layoutCrossword(words)).toEqual(placed);
    expect(Math.min(...placed.map((p) => p.row))).toBe(0);
    expect(Math.min(...placed.map((p) => p.col))).toBe(0);
  });

  it("pins one small layout", () => {
    const words = pool("casa", "cola", "ala", "sapo", "ama");
    const placed = layoutCrossword(words)!;
    expect(picture(words, placed)).toEqual([
      ".casa..", //
      ".o..l..",
      ".l..ama",
      "sapo...",
    ]);
    expect(placed.map((p) => `${words[p.index]!.join("")} ${p.dir}`)).toEqual(["casa across", "cola down", "ala down", "sapo across", "ama across"]);
  });

  it("skips an answer that can cross nothing", () => {
    const placed = layoutCrossword(pool("casa", "sol", "luna", "mesa", "agua", "xyz"))!;
    expect(placed.map((p) => p.index)).not.toContain(5);
    expect(placed).toHaveLength(5);
  });

  it("stops at eight", () => {
    const many = pool("casa", "sala", "mesa", "masa", "pasa", "tasa", "lata", "rata", "gata", "nata", "pala");
    expect(layoutCrossword(many)).toHaveLength(CROSSWORD_MAX);
  });

  it("is nothing when fewer than five fit", () => {
    expect(layoutCrossword(pool("casa", "sol", "luna", "mesa"))).toBeNull();
    expect(layoutCrossword(pool("casa", "sol", "luna", "mesa", "xyz", "qqq"))).toBeNull();
    expect(layoutCrossword([])).toBeNull();
  });
});
