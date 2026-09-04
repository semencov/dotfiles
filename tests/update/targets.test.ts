import { expect, test } from "bun:test";

import { updateTargets } from "../../src/update/targets";
import type { TaskContext } from "../../src/setup/types";
import { createFakeDependencies } from "../support/fakes";

test("default update catalog excludes greedy casks and operating-system updates", () => {
  const targets = updateTargets();
  const defaults = targets.filter(({ defaultSelected }) => defaultSelected).map(({ id }) => id);
  expect(defaults).not.toContain("homebrew-greedy-casks");
  expect(defaults).not.toContain("macos-system-update");
  expect(defaults).not.toContain("debian-system-update");
  expect(new Set(targets.map(({ id }) => id)).size).toBe(targets.length);
});

test("normal provider updates construct native non-greedy commands", async () => {
  const dependencies = createFakeDependencies();
  const context: TaskContext = { ...dependencies, dryRun: false, nonInteractive: true };
  const selected = updateTargets().filter(({ id }) => [
    "homebrew", "bun-globals", "uv-tools", "editor-extensions", "gh-extensions", "mas-apps", "ai-tools",
  ].includes(id));

  for (const target of selected) {
    const preflight = await target.preflight(context);
    expect(preflight.ok, target.id).toBe(true);
    await target.update(context);
  }

  const rendered = JSON.stringify(dependencies.process.commands);
  expect(rendered).not.toContain("--greedy");
  expect(rendered).not.toContain("--break-system-packages");
  expect(rendered).not.toContain('"pip"');
  expect(dependencies.process.commands.map(({ executable, args }) => [executable, ...args])).toContainEqual([
    "brew", "upgrade",
  ]);
});

test("platform-specific system updates reject other platforms before mutation", async () => {
  const dependencies = createFakeDependencies();
  const linuxContext: TaskContext = {
    ...dependencies,
    platform: { os: "ubuntu", arch: "x64", homeDir: "/home/test" },
    dryRun: false,
    nonInteractive: true,
  };
  const macos = updateTargets().find(({ id }) => id === "macos-system-update")!;
  expect((await macos.preflight(linuxContext)).ok).toBe(false);
  expect(dependencies.process.commands).toEqual([]);
});

test("editor update runs only installed editor CLIs", async () => {
  const dependencies = createFakeDependencies();
  dependencies.process.whichResults.set("code", "/fake/bin/code");
  dependencies.process.whichResults.set("cursor", null);
  dependencies.process.whichResults.set("zed", null);
  const context: TaskContext = { ...dependencies, dryRun: false, nonInteractive: true };
  const target = updateTargets().find(({ id }) => id === "editor-extensions")!;

  expect((await target.preflight(context)).ok).toBe(true);
  await target.update(context);

  expect(dependencies.process.commands).toEqual([
    { executable: "code", args: ["--update-extensions"] },
  ]);
});

test("every target constructs commands on each supported platform", async () => {
  for (const os of ["macos", "ubuntu", "debian"] as const) {
    for (const target of updateTargets().filter(({ platforms }) => platforms.includes(os))) {
      const dependencies = createFakeDependencies();
      const context: TaskContext = {
        ...dependencies,
        platform: { os, arch: os === "macos" ? "arm64" : "x64", homeDir: os === "macos" ? "/Users/test" : "/home/test" },
        dryRun: false,
        nonInteractive: false,
      };

      expect((await target.preflight(context)).ok, `${os}:${target.id}`).toBe(true);
      await target.update(context);
      expect(dependencies.process.commands.length, `${os}:${target.id}`).toBeGreaterThan(0);
    }
  }
});
