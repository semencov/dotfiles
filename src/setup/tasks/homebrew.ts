import { join } from "node:path";

import type { CommandResult } from "../../lib/process";
import type { CheckResult, SetupTask, TaskContext } from "../types";

const INSTALL_URL = "https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh";
const LINUX_BOOTSTRAP_PACKAGES = ["build-essential", "procps", "file"] as const;

function brewPath(context: TaskContext): string {
  if (context.platform.os !== "macos") return "/home/linuxbrew/.linuxbrew/bin/brew";
  return context.platform.arch === "arm64" ? "/opt/homebrew/bin/brew" : "/usr/local/bin/brew";
}

async function runBundle(context: TaskContext, executable: string): Promise<void> {
  const brewfile = join(context.paths.repo, "home", "dot_Brewfile");
  const check = await context.process.run({
    executable,
    args: ["bundle", "check", "--file", brewfile],
  });
  if (check.exitCode === 0) return;

  const install = await context.process.run({
    executable,
    args: ["bundle", "install", "--file", brewfile, "--no-upgrade"],
  });
  assertSuccess("brew bundle install", install);
}

function assertSuccess(operation: string, result: CommandResult): void {
  if (result.exitCode !== 0) throw new Error(`${operation} failed with exit code ${result.exitCode}`);
}

async function installUbuntuPrerequisites(context: TaskContext): Promise<void> {
  const missing: string[] = [];
  for (const name of LINUX_BOOTSTRAP_PACKAGES) {
    const status = await context.process.run({
      executable: "dpkg-query",
      args: ["-W", "-f=${Status}", name],
    });
    if (status.exitCode !== 0 || !status.stdout.includes("install ok installed")) missing.push(name);
  }
  if (missing.length === 0) return;

  assertSuccess("apt-get update", await context.process.run({
    executable: "sudo",
    args: ["apt-get", "update"],
  }));
  assertSuccess("apt-get install", await context.process.run({
    executable: "sudo",
    args: ["apt-get", "install", "-y", ...missing],
  }));
}

async function installHomebrew(context: TaskContext): Promise<string> {
  if (context.platform.os !== "macos") await installUbuntuPrerequisites(context);

  await context.fs.mkdir(context.paths.state, 0o700);
  const temporaryDirectory = await context.fs.mkdtemp(join(context.paths.state, "homebrew-install-"));
  const installer = join(temporaryDirectory, "install.sh");
  try {
    assertSuccess("download Homebrew installer", await context.process.run({
      executable: "curl",
      args: ["-fsSL", "-o", installer, INSTALL_URL],
    }));
    assertSuccess("Homebrew installer", await context.process.run({
      executable: "/bin/bash",
      args: [installer],
      env: { NONINTERACTIVE: "1" },
    }));
  } finally {
    await context.fs.removeTree(temporaryDirectory);
  }

  return brewPath(context);
}

async function preflight(context: TaskContext): Promise<CheckResult> {
  if (await context.process.which("brew") !== null) return { ok: true };

  const required = context.platform.os !== "macos"
    ? ["curl", "/bin/bash", "sudo", "apt-get", "dpkg-query"]
    : ["curl", "/bin/bash"];
  const missing: string[] = [];
  for (const executable of required) {
    if (await context.process.which(executable) === null) missing.push(executable);
  }
  return missing.length === 0
    ? { ok: true }
    : { ok: false, detail: `Cannot install Homebrew; missing: ${missing.join(", ")}` };
}

export function createHomebrewTask(): SetupTask {
  return {
    id: "homebrew-packages",
    title: "Homebrew packages",
    platforms: ["macos", "ubuntu", "debian"],
    dependencies: ["core-tools"],
    defaultSelected: true,
    risk: "medium",
    privilege: "command-sudo",
    mutations: ["install missing Homebrew/Brewfile packages"],
    preflight,
    apply: async (context) => {
      if (context.dryRun) {
        context.logger.info("Would reconcile the Homebrew bundle", {
          brewfile: join(context.paths.repo, "home", "dot_Brewfile"),
        });
        return;
      }
      const existing = await context.process.which("brew");
      const executable = existing === null ? await installHomebrew(context) : "brew";
      await runBundle(context, executable);
    },
    verify: async (context) => {
      const executable = await context.process.which("brew") ?? brewPath(context);
      if (context.dryRun) return { ok: true };
      const result = await context.process.run({
        executable,
        args: ["bundle", "check", "--file", join(context.paths.repo, "home", "dot_Brewfile")],
      });
      return result.exitCode === 0
        ? { ok: true }
        : { ok: false, detail: "Homebrew bundle is not converged" };
    },
  };
}
