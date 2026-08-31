import type { CheckResult, SetupTask, TaskContext } from "../types";

async function zshExecutable(context: TaskContext): Promise<string | null> {
  return await context.process.which("zsh")
    ?? (context.platform.os === "macos" ? null : "/home/linuxbrew/.linuxbrew/bin/zsh");
}

async function zshAvailable(context: TaskContext): Promise<CheckResult> {
  const executable = await zshExecutable(context);
  if (executable === null) return { ok: false, detail: "zsh is unavailable after package setup" };
  const result = await context.process.run({ executable, args: ["--version"] });
  return result.exitCode === 0
    ? { ok: true }
    : { ok: false, detail: "zsh does not respond after package setup" };
}

export function createShellTask(): SetupTask {
  return {
    id: "shell",
    title: "Shell",
    platforms: ["macos", "ubuntu", "debian"],
    dependencies: ["homebrew-packages"],
    defaultSelected: true,
    risk: "medium",
    privilege: "user",
    preflight: async (context) => {
      if (context.platform.os === "macos" || context.nonInteractive) return { ok: true };
      return await context.process.which("chsh") === null
        ? { ok: false, detail: "chsh is required for an interactive Linux login-shell change" }
        : { ok: true };
    },
    apply: async (context) => {
      if (context.platform.os === "macos" || context.dryRun || context.nonInteractive) return;
      const zsh = await zshExecutable(context);
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
