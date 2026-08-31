import { expect, test } from "bun:test";

import { prepareSetupPlan } from "../../src/setup/prompts";
import type { TaskContext } from "../../src/setup/types";
import { createFakeDependencies } from "../support/fakes";
import { task } from "./helpers";

test("prepareSetupPlan returns 130 on cancellation and performs no process mutation", async () => {
  const dependencies = createFakeDependencies();
  dependencies.prompts.confirmResult = false;
  const context: TaskContext = { ...dependencies, dryRun: false };

  const result = await prepareSetupPlan([
    task("core", { defaultSelected: true, risk: "medium", privilege: "command-sudo" }),
  ], { selected: [], skipped: [], nonInteractive: false }, context);

  expect(result).toEqual({ ok: false, exitCode: 130 });
  expect(dependencies.process.commands).toEqual([]);
  expect(JSON.stringify(dependencies.logger.entries)).toContain("command-sudo");
});
