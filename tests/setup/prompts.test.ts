import { expect, test } from "bun:test";

import { prepareSetupPlan } from "../../src/setup/prompts";
import type { TaskContext } from "../../src/setup/types";
import { createFakeDependencies } from "../support/fakes";
import { task } from "./helpers";

function visiblePlan(dependencies: ReturnType<typeof createFakeDependencies>): string {
  return dependencies.logger.entries
    .filter(({ level }) => level === "info")
    .map(({ message }) => message)
    .join("\n");
}

test("prepareSetupPlan shows the actionable plan before interactive confirmation", async () => {
  const dependencies = createFakeDependencies();
  const context: TaskContext = { ...dependencies, dryRun: false, nonInteractive: false };

  const result = await prepareSetupPlan([
    task("core", { defaultSelected: true }),
    task("shell", {
      defaultSelected: true,
      dependencies: ["core"],
      risk: "medium",
      mutations: ["replace shell configuration"],
    }),
  ], { selected: [], skipped: [], nonInteractive: false }, context);

  expect(result.ok).toBe(true);
  expect(visiblePlan(dependencies)).toContain("shell");
  expect(visiblePlan(dependencies)).toContain("replace shell configuration");
  expect(visiblePlan(dependencies)).toContain("After tasks: archive conflicts, apply chezmoi HOME state, verify convergence");
});

test("prepareSetupPlan shows the actionable plan in non-interactive mode", async () => {
  const dependencies = createFakeDependencies();
  const context: TaskContext = { ...dependencies, dryRun: true, nonInteractive: true };

  const result = await prepareSetupPlan([
    task("core"),
    task("shell", {
      dependencies: ["core"],
      mutations: ["replace shell configuration"],
    }),
  ], { selected: ["shell"], skipped: [], nonInteractive: true }, context);

  expect(result.ok).toBe(true);
  expect(visiblePlan(dependencies)).toContain("DRY RUN · macos/arm64");
  expect(visiblePlan(dependencies)).toContain("core");
  expect(visiblePlan(dependencies)).toContain("shell");
  expect(visiblePlan(dependencies)).toContain("replace shell configuration");
  expect(visiblePlan(dependencies)).toContain("After tasks: archive conflicts, apply chezmoi HOME state, verify convergence");
});

test("prepareSetupPlan returns 130 on cancellation and performs no process mutation", async () => {
  const dependencies = createFakeDependencies();
  dependencies.prompts.confirmResult = false;
  const context: TaskContext = { ...dependencies, dryRun: false, nonInteractive: false };

  const result = await prepareSetupPlan([
    task("core", { defaultSelected: true, risk: "medium", privilege: "command-sudo" }),
  ], { selected: [], skipped: [], nonInteractive: false }, context);

  expect(result).toEqual({ ok: false, exitCode: 130 });
  expect(dependencies.process.commands).toEqual([]);
  expect(JSON.stringify(dependencies.logger.entries)).toContain("command-sudo");
});
