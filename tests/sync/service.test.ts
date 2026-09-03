import { expect, test } from "bun:test";

import { runSyncTransaction, type SyncTransactionServices } from "../../src/sync/service";
import type { LiveSnapshot } from "../../src/sync/types";

function harness(overrides: Partial<SyncTransactionServices> = {}) {
  const events: string[] = [];
  const snapshot: LiveSnapshot = {
    path: "/private/snapshot",
    entries: [],
    cleanup: async () => { events.push("cleanup"); },
  };
  const services: SyncTransactionServices = {
    assertPreconditions: async () => { events.push("preconditions"); },
    capture: async () => { events.push("capture"); return snapshot; },
    fetch: async () => { events.push("fetch"); },
    merge: async () => { events.push("merge"); return "merged"; },
    resolveRegisteredConflicts: async () => { events.push("conflicts"); },
    applySnapshot: async () => { events.push("apply-snapshot"); return ["home/dot_zshrc"]; },
    validate: async () => { events.push("validate"); },
    commit: async () => { events.push("commit"); return "abc123"; },
    push: async () => { events.push("push"); },
    abortMerge: async () => { events.push("abort"); },
    ...overrides,
  };
  return { events, services };
}

test("runs the exact last-sync-wins transaction and one publication commit", async () => {
  const { events, services } = harness();
  const result = await runSyncTransaction({ push: true, dryRun: false, message: "sync" }, services);

  expect(result).toEqual({ changedSources: ["home/dot_zshrc"], commit: "abc123", pushed: true, warnings: [] });
  expect(events).toEqual([
    "preconditions", "capture", "fetch", "merge", "conflicts", "apply-snapshot", "validate", "commit", "push", "cleanup",
  ]);
});

test("dry-run fetches and previews without merging or mutating source", async () => {
  const { events, services } = harness();
  const result = await runSyncTransaction({ push: true, dryRun: true, message: "sync" }, services);
  expect(result.commit).toBeNull();
  expect(events).toEqual(["preconditions", "capture", "fetch", "apply-snapshot", "cleanup"]);
});

test("retains a valid commit and reports push failure as a warning", async () => {
  const { services } = harness({ push: async () => { throw new Error("offline"); } });
  const result = await runSyncTransaction({ push: true, dryRun: false, message: "sync" }, services);
  expect(result.commit).toBe("abc123");
  expect(result.pushed).toBe(false);
  expect(result.warnings).toEqual(["Push failed; local commit abc123 was preserved"]);
});

test("aborts an owned merge and cleans up after post-merge failure", async () => {
  const { events, services } = harness({ validate: async () => { throw new Error("invalid"); } });
  await expect(runSyncTransaction({ push: false, dryRun: false, message: "sync" }, services)).rejects.toThrow("invalid");
  expect(events).toContain("abort");
  expect(events.at(-1)).toBe("cleanup");
});

test("does not capture or mutate when preconditions fail", async () => {
  const { events, services } = harness({ assertPreconditions: async () => { events.push("preconditions"); throw new Error("dirty"); } });
  await expect(runSyncTransaction({ push: false, dryRun: false, message: "sync" }, services)).rejects.toThrow("dirty");
  expect(events).toEqual(["preconditions"]);
});
