import type { CheckResult, SetupTask, TaskContext } from "../types";

async function verifyHooksPath(context: TaskContext): Promise<CheckResult> {
  const result = await context.process.run({
    executable: "git",
    args: ["-C", context.paths.repo, "config", "--get", "core.hooksPath"],
  });
  return result.exitCode === 0 && result.stdout.trim() === ".githooks"
    ? { ok: true }
    : { ok: false, detail: "Repository core.hooksPath is not .githooks" };
}

export function createGitTask(): SetupTask {
  return {
    id: "git",
    title: "Git",
    platforms: ["macos", "ubuntu", "debian"],
    dependencies: ["core-tools"],
    defaultSelected: true,
    risk: "low",
    privilege: "user",
    mutations: ["configure repository hooks and GitHub credentials"],
    preflight: async (context) => await context.process.which("git") === null
      ? { ok: false, detail: "Git is unavailable" }
      : { ok: true },
    apply: async (context) => {
      if (context.dryRun) return;
      const config = await context.process.run({
        executable: "git",
        args: ["-C", context.paths.repo, "config", "core.hooksPath", ".githooks"],
      });
      if (config.exitCode !== 0) throw new Error(`git config failed with exit code ${config.exitCode}`);

      if (await context.process.which("gh") === null) {
        context.logger.warn("GitHub CLI is unavailable; install gh and run `gh auth login`");
        return;
      }
      const auth = await context.process.run({ executable: "gh", args: ["auth", "status"] });
      if (auth.exitCode !== 0) {
        context.logger.warn("GitHub CLI is not authenticated; run `gh auth login`, then `gh auth setup-git`");
        return;
      }
      const setup = await context.process.run({ executable: "gh", args: ["auth", "setup-git"] });
      if (setup.exitCode !== 0) context.logger.warn("GitHub CLI could not configure Git credentials; run `gh auth setup-git`");
    },
    verify: verifyHooksPath,
  };
}
