import { expect, test } from "bun:test";

import { resolveUpdateTargets } from "../../src/update/graph";
import { updateTarget } from "./helpers";

test("expands dependencies in stable order and applies explicit selection over saved/default", () => {
  const targets = [
    updateTarget("runtime"),
    updateTarget("packages", { dependencies: ["runtime"], defaultSelected: true }),
    updateTarget("opt-in", { defaultSelected: false }),
  ];
  expect(resolveUpdateTargets(targets, {
    platform: "macos",
    saved: ["opt-in"],
    selected: ["packages"],
    skipped: ["opt-in"],
  }).map(({ id }) => id)).toEqual(["runtime", "packages"]);
});

test("rejects cycles, unknown dependencies, and skipped required dependencies", () => {
  expect(() => resolveUpdateTargets([
    updateTarget("a", { dependencies: ["b"], defaultSelected: true }),
    updateTarget("b", { dependencies: ["a"] }),
  ], { platform: "macos", selected: [], skipped: [] })).toThrow("cycle");
  expect(() => resolveUpdateTargets([
    updateTarget("a", { dependencies: ["missing"], defaultSelected: true }),
  ], { platform: "macos", selected: [], skipped: [] })).toThrow("Unknown");
  expect(() => resolveUpdateTargets([
    updateTarget("a"),
    updateTarget("b", { dependencies: ["a"], defaultSelected: true }),
  ], { platform: "macos", selected: [], skipped: ["a"] })).toThrow("required");
});

test("ignores platform-incompatible default targets but rejects explicit incompatible selections", () => {
  const targets = [
    updateTarget("portable", { defaultSelected: true }),
    updateTarget("mac-only", { defaultSelected: true, platforms: ["macos"] }),
  ];

  expect(resolveUpdateTargets(targets, {
    platform: "ubuntu",
    selected: [],
    skipped: [],
  }).map(({ id }) => id)).toEqual(["portable"]);

  expect(() => resolveUpdateTargets(targets, {
    platform: "ubuntu",
    selected: ["mac-only"],
    skipped: [],
  })).toThrow("unavailable on ubuntu");
});

test("orders dependencies before dependents regardless of catalog order", () => {
  const targets = [
    updateTarget("packages", { dependencies: ["runtime"], defaultSelected: true }),
    updateTarget("runtime"),
  ];

  expect(resolveUpdateTargets(targets, {
    platform: "macos",
    selected: [],
    skipped: [],
  }).map(({ id }) => id)).toEqual(["runtime", "packages"]);
});
