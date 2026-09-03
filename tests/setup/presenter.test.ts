import { expect, test } from "bun:test";

import { renderSetupPlan } from "../../src/setup/presenter";
import { createCoreToolsTask } from "../../src/setup/tasks/core-tools";
import { createShellTask } from "../../src/setup/tasks/shell";

test("renders task dependencies, risk, privilege, mutations, and the HOME lifecycle", () => {
  const output = renderSetupPlan(
    [createCoreToolsTask(), createShellTask()],
    { os: "macos", arch: "arm64", homeDir: "/Users/test" },
    true,
  );

  expect(output).toContain("DRY RUN · macos/arm64");
  expect(output).toContain("core-tools");
  expect(output).toContain("shell");
  expect(output).toContain("homebrew-packages");
  expect(output).toContain("medium");
  expect(output).toContain("user");
  expect(output).toContain("optionally change Linux login shell");
  expect(output).toContain("After tasks: archive conflicts, apply chezmoi HOME state, verify convergence");
  expect(output.endsWith("\n")).toBe(true);
});
