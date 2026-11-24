// ESLint (issue #300): typescript-eslint's recommended rules and the two classic React
// hooks rules. `pnpm lint`, in `pnpm check` and CI. A disable comment says why after `--`,
// and one that no longer silences anything fails the run.
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/** Why a raw read of the Documents table fails lint, and how one that must stays (#643). */
const rawDocumentsRead = (what, rule) =>
  `${what} reads Documents around Core's gates (Private while locked, other Workspaces: ADR 0038, 0048). Read through getDocument / documentsOf / documentsWhere / useDocuments, or documentsOfUngated for a check that must see past the gates. A read that must bypass them stays behind \`// eslint-disable-next-line ${rule} -- <reason>\`: the reason is required.`;

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      ".claude/",
      // Goja scripts run by PocketBase, against its own globals: not our TypeScript.
      "pocketbase/",
      "shell/src-tauri/",
      "shell/test-results/",
      "shell/playwright-report/",
    ],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // tsc's noUnusedLocals/noUnusedParameters already fail on these; here only the
      // conventions it allows: a `_` name marks a deliberately unused binding, and a
      // destructured sibling of a rest element is how a field is dropped from a copy.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    // Only the classic pair. The plugin's v7 `recommended` also brings the React Compiler
    // rules (purity, refs, set-state-in-effect...); this code is not written for the
    // Compiler, and adopting them is a decision of its own.
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // Reads go through Core's gates (ADR 0038: Private while locked; ADR 0048: other
    // Workspaces), so the raw table stays inside Core (#643). A read that must go around
    // them says why on the import line; tests and e2e set up the store as they like.
    files: ["apps/**/*.{ts,tsx}", "shell/src/**/*.{ts,tsx}", "mcp/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    ignores: ["packages/core/**", "**/*.test.{ts,tsx}", "packages/parts/src/testing.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@lifeline/core",
              importNames: ["documentsTable", "DOCUMENTS"],
              message: rawDocumentsRead("This import", "no-restricted-imports"),
            },
          ],
        },
      ],
      // The same table by its other routes: `db().documents`, `db().table|collection("documents")`,
      // `get|all("documents")`, or `documentsTable` reached off a namespace or dynamic import.
      "no-restricted-syntax": [
        "error",
        ...[
          "MemberExpression[property.name='documentsTable']",
          "MemberExpression[object.type='CallExpression'][object.callee.name='db'][property.name='documents']",
          "CallExpression[callee.property.name=/^(table|collection)$/][arguments.0.value='documents']",
          "CallExpression[callee.name=/^(get|all)$/][arguments.0.value='documents']",
        ].map((selector) => ({ selector, message: rawDocumentsRead("This", "no-restricted-syntax") })),
      ],
    },
  },
  {
    // Playwright's fixtures take a `use` callback; it is not React's `use`.
    files: ["shell/e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
);
