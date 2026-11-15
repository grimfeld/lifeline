// SessionStart hook (.claude/settings.json): in a cloud session (CLAUDE_CODE_REMOTE set) the
// main checkout is committed in directly, without `pnpm worktree:new`, so set the agent
// commit email here, or the pre-push hook refuses the first push. A local session is left alone.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const AGENT_EMAIL = "claude@grimfeld.tech";

export function setCloudEmail(env, git) {
  if (!env.CLAUDE_CODE_REMOTE) return false;
  git("config", "user.email", AGENT_EMAIL);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  setCloudEmail(process.env, (...args) => execFileSync("git", args, { cwd, stdio: "ignore" }));
}
