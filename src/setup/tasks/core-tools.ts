import type { CheckResult, SetupTask, TaskContext } from "../types";

const REQUIRED_TOOLS = ["bun", "chezmoi", "git"] as const;

async function checkRequiredTools(context: TaskContext): Promise<CheckResult> {
  const missing: string[] = [];
  for (const executable of REQUIRED_TOOLS) {
    if (await context.process.which(executable) === null) missing.push(executable);
  }

  return missing.length === 0
    ? { ok: true }
    : {
        ok: false,
        detail: `Missing required tools: ${missing.join(", ")}`,
        remediation: "Run the repository bootstrap installer, then retry setup",
      };
}

export function createCoreToolsTask(): SetupTask {
  return {
    id: "core-tools",
    title: "Core tools",
    platforms: ["macos", "ubuntu", "debian"],
    dependencies: [],
    defaultSelected: true,
    risk: "low",
    privilege: "user",
    preflight: checkRequiredTools,
    apply: async () => undefined,
    verify: checkRequiredTools,
  };
}
