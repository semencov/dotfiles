import { expect, test } from "bun:test";

import { runUpdateLifecycle } from "../../src/commands/update";
import { runSetupInventoryLifecycle } from "../../src/commands/setup";
import type { UpdateSummaryEntry } from "../../src/update/types";

test("partial target failure preserves complete results, captures safe config, and does not commit", async () => {
  const events: string[] = [];
  const summary: readonly UpdateSummaryEntry[] = [
    { id: "homebrew", status: "failed", detail: "upgrade failed" },
    { id: "brew-inventory", status: "skipped-dependency", detail: "homebrew" },
    { id: "editor-extensions", status: "updated" },
  ];
  const result = await runUpdateLifecycle({
    sync: async (afterApply) => {
      events.push("sync-start");
      await afterApply();
      events.push("no-commit");
      return { commit: null, pushed: false, warnings: [] };
    },
    applyManagedState: async () => { events.push("apply"); },
    runTargets: async () => { events.push("targets"); return { exitCode: 1, summary }; },
    snapshotInventories: async () => { events.push("inventories"); },
    captureFinalConfig: async () => { events.push("capture-final"); },
  });

  expect(result.exitCode).toBe(1);
  expect(result.summary).toEqual(summary);
  expect(events).toEqual(["sync-start", "apply", "targets", "inventories", "capture-final", "no-commit"]);
});

test("successful setup snapshots inventories inside one publication transaction", async () => {
  const events: string[] = [];
  await runSetupInventoryLifecycle({
    sync: async (snapshot) => {
      events.push("sync-start");
      await snapshot();
      events.push("commit");
      return { commit: "abc", pushed: true, warnings: [] };
    },
    snapshotInventories: async () => { events.push("inventories"); },
  });

  expect(events).toEqual(["sync-start", "inventories", "commit"]);
});
