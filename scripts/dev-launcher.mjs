#!/usr/bin/env node
// Launch scripts/dev.sh with a working bash.
// On Windows, plain `bash` resolves to System32's WSL bash, which chokes on
// the Windows node/corepack shims (CRLF shebangs). Use Git Bash instead.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const devSh = path.join(path.dirname(fileURLToPath(import.meta.url)), "dev.sh");

function findBash() {
  if (process.platform !== "win32") return "bash";

  const where = spawnSync("where", ["git.exe"], { encoding: "utf8" });
  for (const gitExe of (where.stdout ?? "").split(/\r?\n/).filter(Boolean)) {
    // C:\Program Files\Git\cmd\git.exe -> C:\Program Files\Git\bin\bash.exe
    const bash = path.join(path.dirname(path.dirname(gitExe)), "bin", "bash.exe");
    if (existsSync(bash)) return bash;
  }

  console.error("error: Git Bash not found; install Git for Windows (https://gitforwindows.org)");
  process.exit(1);
}

const result = spawnSync(findBash(), [devSh], { stdio: "inherit" });
process.exit(result.status ?? 1);
