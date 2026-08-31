import { describe, expect, test } from "bun:test";

import { SetupRunner } from "../../src/setup/runner";
import type { TaskContext } from "../../src/setup/types";
import { createFakeDependencies } from "../support/fakes";
import { task } from "./helpers";

const context = () => ({ ...createFakeDependencies(), dryRun: false, nonInteractive: false }) satisfies TaskContext;

describe("SetupRunner", () => {
  test("finishes every preflight before the first mutation", async () => {
    const events: string[] = [];
    const tasks = ["core", "shell"].map((id) => task(id, {
      preflight: async () => { events.push(`preflight:${id}`); return { ok: true }; },
      apply: async () => { events.push(`apply:${id}`); },
      verify: async () => { events.push(`verify:${id}`); return { ok: true }; },
    }));

    const result = await new SetupRunner(() => 10).run(tasks, context());

    expect(result.ok).toBe(true);
    expect(events).toEqual([
      "preflight:core",
      "preflight:shell",
      "apply:core",
      "verify:core",
      "apply:shell",
      "verify:shell",
    ]);
  });

  test("applies nothing when any preflight fails", async () => {
    const events: string[] = [];
    const tasks = [
      task("broken", { preflight: async () => ({ ok: false, detail: "missing dependency" }), apply: async () => { events.push("apply"); } }),
      task("checked", { preflight: async () => { events.push("checked"); return { ok: true }; } }),
    ];

    const result = await new SetupRunner().run(tasks, context());

    expect(result.ok).toBe(false);
    expect(events).toEqual(["checked"]);
  });

  test("dry-run stops after the complete preflight barrier", async () => {
    const events: string[] = [];
    const tasks = [task("planned", {
      preflight: async () => { events.push("preflight"); return { ok: true }; },
      apply: async () => { events.push("apply"); },
      verify: async () => { events.push("verify"); return { ok: true }; },
    })];

    const result = await new SetupRunner().run(tasks, { ...createFakeDependencies(), dryRun: true, nonInteractive: false }, {
      beforeApply: async () => { events.push("beforeApply"); },
    });

    expect(result.ok).toBe(true);
    expect(events).toEqual(["preflight"]);
  });

  test("stops at the first apply failure", async () => {
    const events: string[] = [];
    const tasks = [
      task("broken", { apply: async () => { events.push("broken"); throw new Error("synthetic secret"); } }),
      task("dependent", { apply: async () => { events.push("dependent"); } }),
    ];
    const dependencies = context();

    const result = await new SetupRunner().run(tasks, dependencies);

    expect(result.ok).toBe(false);
    expect(events).toEqual(["broken"]);
    expect(JSON.stringify(dependencies.logger.entries)).not.toContain("synthetic secret");
  });

  test("reruns from observed state after a failure without success markers", async () => {
    let installed = false;
    const convergent = task("core", {
      apply: async (taskContext) => {
        if (installed) return;
        installed = true;
        await taskContext.process.run({ executable: "installer", args: [] });
      },
    });
    const runner = new SetupRunner();
    const dependencies = context();
    dependencies.process.failAfterRun = new Error("interrupted after operation");

    expect((await runner.run([convergent], dependencies)).ok).toBe(false);
    expect((await runner.run([convergent], dependencies)).ok).toBe(true);
    expect(dependencies.process.commands).toHaveLength(1);
  });
});
