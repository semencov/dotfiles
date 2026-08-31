import type { CheckResult, SetupTask, TaskContext } from "../types";

async function zshAvailable(context: TaskContext): Promise<CheckResult> {
  return await context.process.which("zsh") === null
    ? { ok: false, detail: "zsh is unavailable after package setup" }
    : { ok: true };
}

export function createShellTask(): SetupTask {
  return {
    id: "shell",
    title: "Shell",
    platforms: ["macos", "ubuntu"],
    dependencies: ["homebrew-packages"],
    defaultSelected: true,
    risk: "medium",
    privilege: "user",
    preflight: async () => ({ ok: true }),
    apply: async (context) => {
      if (context.platform.os !== "ubuntu" || context.dryRun) return;
      const zsh = await context.process.which("zsh");
      if (zsh === null) throw new Error("zsh is unavailable after package setup");
      const confirmed = await context.prompts.confirm({
        message: `Change the login shell to ${zsh}?`,
        initialValue: false,
      });
      if (!confirmed) return;
      const result = await context.process.run({ executable: "chsh", args: ["-s", zsh], stdin: "inherit" });
      if (result.exitCode !== 0) throw new Error(`chsh failed with exit code ${result.exitCode}`);
    },
    verify: zshAvailable,
  };
}
