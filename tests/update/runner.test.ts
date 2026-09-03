import { expect, test } from "bun:test";

import { UpdateRunner } from "../../src/update/runner";
import type { TaskContext } from "../../src/setup/types";
import { createFakeDependencies } from "../support/fakes";
import { updateTarget } from "./helpers";

test("continues independent targets and skips failed dependents with stable summary", async () => {
  const events: string[] = [];
  const dependencies = createFakeDependencies();
  const context: TaskContext = { ...dependencies, dryRun: false, nonInteractive: true };
  const runner = new UpdateRunner([
    updateTarget("homebrew", { group: "packages", update: async () => { events.push("homebrew"); throw new Error("upgrade failed"); } }),
    updateTarget("inventory", { group: "packages", dependencies: ["homebrew"], update: async () => { events.push("inventory"); } }),
    updateTarget("editor", { group: "editors", update: async () => { events.push("editor"); } }),
  ]);

  const result = await runner.run(context);

  expect(events).toEqual(["homebrew", "editor"]);
  expect(result.exitCode).toBe(1);
  expect(result.summary).toEqual([
    { id: "homebrew", status: "failed", detail: "upgrade failed" },
    { id: "inventory", status: "skipped-dependency", detail: "homebrew" },
    { id: "editor", status: "updated" },
  ]);
});

test("marks unavailable preflights without failing independent updates", async () => {
  const dependencies = createFakeDependencies();
  const context: TaskContext = { ...dependencies, dryRun: false, nonInteractive: true };
  const runner = new UpdateRunner([
    updateTarget("missing", { preflight: async () => ({ ok: false, detail: "tool missing" }) }),
    updateTarget("ready"),
  ]);
  const result = await runner.run(context);
  expect(result.exitCode).toBe(0);
  expect(result.summary.map(({ status }) => status)).toEqual(["unavailable", "updated"]);
});
