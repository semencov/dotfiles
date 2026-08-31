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

test("apply validates, diffs, backs up conflicts, applies, then verifies convergence", async () => {
  const events: string[] = [];
  const services: ApplyServices = {
    verifyTemplates: async () => { events.push("templates"); return { exitCode: 0, stdout: "", stderr: "" }; },
    diff: async () => { events.push("diff"); return events.filter((event) => event === "diff").length === 1 ? "changes" : ""; },
    backupConflicts: async () => { events.push("backup"); },
    apply: async () => { events.push("apply"); return { exitCode: 0, stdout: "", stderr: "" }; },
  };

  await expect(runApplyCommand(createFakeDependencies(), { dryRun: false }, services)).resolves.toBe(0);
  expect(events).toEqual(["templates", "diff", "backup", "apply", "diff"]);
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
