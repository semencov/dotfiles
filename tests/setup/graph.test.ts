import { describe, expect, test } from "bun:test";

import { SetupGraphError, resolveTaskGraph } from "../../src/setup/graph";
import { task } from "./helpers";

describe("resolveTaskGraph", () => {
  test("includes transitive dependencies in stable declaration order", () => {
    const tasks = [
      task("core"),
      task("git", { dependencies: ["core"] }),
      task("shell", { dependencies: ["core"] }),
      task("workstation", { dependencies: ["git", "shell"] }),
    ];

    expect(resolveTaskGraph(tasks, ["workstation"], "macos").map(({ id }) => id)).toEqual([
      "core",
      "git",
      "shell",
      "workstation",
    ]);
  });

  test("rejects dependency cycles", () => {
    const tasks = [task("a", { dependencies: ["b"] }), task("b", { dependencies: ["a"] })];
    expect(() => resolveTaskGraph(tasks, ["a"], "macos")).toThrow(SetupGraphError);
  });

  test("rejects unknown dependencies", () => {
    expect(() => resolveTaskGraph([task("a", { dependencies: ["missing"] })], ["a"], "macos")).toThrow(
      "Unknown setup task dependency: a -> missing",
    );
  });

  test("rejects selected tasks unavailable on the active platform", () => {
    const macOnly = task("gui", { platforms: ["macos"] });
    expect(() => resolveTaskGraph([macOnly], ["gui"], "ubuntu")).toThrow(
      "Setup task is unavailable on ubuntu: gui",
    );
  });
});
