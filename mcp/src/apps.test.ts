import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("the server's App registry", () => {
  it("holds every App the repository has, so its devices know every type", () => {
    const names = readdirSync(join(root, "apps")).map((dir) => (JSON.parse(read(`apps/${dir}/package.json`)) as { name: string }).name);
    const deps = Object.keys((JSON.parse(read("mcp/package.json")) as { dependencies: Record<string, string> }).dependencies);
    const registry = read("mcp/src/apps.ts");
    for (const name of names) {
      expect(deps, `${name} missing from mcp/package.json`).toContain(name);
      expect(registry, `${name} missing from mcp/src/apps.ts`).toContain(`from "${name}"`);
    }
  });
});
