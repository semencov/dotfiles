import { describe, expect, test } from "bun:test";

import { resolveSelection, resolveSetupTasks } from "../../src/setup/selection";
import { task } from "./helpers";

describe("resolveSelection", () => {
  test("uses saved selections instead of task defaults when saved state exists", () => {
    const tasks = [task("default", { defaultSelected: true }), task("saved")];
    expect(resolveSelection(tasks, { saved: ["saved"], selected: [], skipped: [], nonInteractive: true })).toEqual([
      "saved",
    ]);
  });

  test("applies skip over select over saved over defaults", () => {
    const tasks = [
      task("default", { defaultSelected: true }),
      task("saved"),
      task("selected"),
      task("skipped", { defaultSelected: true }),
    ];
    expect(resolveSelection(tasks, {
      saved: ["saved", "skipped"],
      selected: ["selected", "skipped"],
      skipped: ["skipped"],
      nonInteractive: true,
    })).toEqual(["saved", "selected"]);
  });

  test("rejects skipping a dependency required by a selected task", () => {
    const tasks = [task("core"), task("shell", { dependencies: ["core"] })];
    expect(() => resolveSetupTasks(tasks, {
      saved: [],
      selected: ["shell"],
      skipped: ["core"],
      nonInteractive: true,
    }, "macos")).toThrow("Cannot skip required setup dependency: core");
  });
});
