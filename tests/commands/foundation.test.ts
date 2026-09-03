import { describe, expect, test } from "bun:test";

import { runApplyCommand, type ApplyServices } from "../../src/commands/apply";
import { runEditCommand } from "../../src/commands/edit";
import { runCli } from "../../src/cli/main";
import type { SetupCommandOptions } from "../../src/cli/dependencies";
import { createFakeDependencies } from "../support/fakes";

test("CLI forwards setup selections and dry-run without executing a subprocess", async () => {
  let received: SetupCommandOptions | undefined;
  const dependencies = createFakeDependencies({
    setup: async (options) => { received = options; return 0; },
  });

  await expect(runCli([
    "bun",
    "dotfiles",
    "setup",
    "--non-interactive",
    "--select",
    "core-tools",
    "shell",
    "--skip",
    "git",
    "--dry-run",
  ], dependencies)).resolves.toBe(0);

  expect(received).toEqual({ nonInteractive: true, select: ["core-tools", "shell"], skip: ["git"], dryRun: true });
  expect(dependencies.process.commands).toEqual([]);
});

test("CLI accepts comma-separated setup selections from the bootstrap", async () => {
  let received: SetupCommandOptions | undefined;
  const dependencies = createFakeDependencies({
    setup: async (options) => { received = options; return 0; },
  });

  await expect(runCli([
    "bun",
    "dotfiles",
    "setup",
    "--non-interactive",
    "--select",
    "core-tools,shell,git",
    "--skip",
    "homebrew-packages",
  ], dependencies)).resolves.toBe(0);

  expect(received?.select).toEqual(["core-tools", "shell", "git"]);
  expect(received?.skip).toEqual(["homebrew-packages"]);
});

test("apply validates, diffs, backs up conflicts, applies, then verifies convergence", async () => {
  const events: string[] = [];
  const dependencies = createFakeDependencies({}, {
    "/Users/test/.config/chezmoi/chezmoi.json": JSON.stringify({ sourceDir: "/Users/test/.dotfiles" }),
    "/Users/test/.dotfiles/.chezmoiroot": "home\n",
  });
  const services: ApplyServices = {
    verifyTemplates: async () => { events.push("templates"); return { exitCode: 0, stdout: "", stderr: "" }; },
    diff: async () => { events.push("diff"); return events.filter((event) => event === "diff").length === 1 ? "changes" : ""; },
    backupConflicts: async () => { events.push("backup"); },
    apply: async () => { events.push("apply"); return { exitCode: 0, stdout: "", stderr: "" }; },
  };

  await expect(runApplyCommand(dependencies, { dryRun: false }, services)).resolves.toBe(0);
  expect(events).toEqual(["templates", "diff", "backup", "apply", "diff"]);
});

test("apply stops before commands or backup mutation when chezmoi is not configured", async () => {
  const dependencies = createFakeDependencies();

  await expect(runApplyCommand(dependencies, { dryRun: false })).resolves.toBe(1);

  expect(dependencies.process.commands).toEqual([]);
  expect(dependencies.fs.createdDirectories).toEqual([]);
  expect(JSON.stringify(dependencies.logger.entries)).toContain("dotfiles setup");
});

describe("edit", () => {
  test("prefers GUI_EDITOR and passes the repository as one argument without a shell", async () => {
    const dependencies = createFakeDependencies();

    await expect(runEditCommand(dependencies, {
      GUI_EDITOR: "code --reuse-window",
      VISUAL: "micro",
      EDITOR: "vim",
    })).resolves.toBe(0);

    expect(dependencies.process.commands).toEqual([{
      executable: "code",
      args: ["--reuse-window", "/Users/test/.dotfiles"],
      stdin: "inherit",
    }]);
  });
});
