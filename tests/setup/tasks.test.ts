import { describe, expect, test } from "bun:test";

import { foundationTasks } from "../../src/setup/catalog";
import { createHomebrewTask } from "../../src/setup/tasks/homebrew";
import { createShellTask } from "../../src/setup/tasks/shell";
import type { TaskContext } from "../../src/setup/types";
import { createFakeDependencies } from "../support/fakes";

function context(os: "macos" | "ubuntu" = "macos"): TaskContext & ReturnType<typeof createFakeDependencies> {
  const dependencies = createFakeDependencies();
  return { ...dependencies, platform: { ...dependencies.platform, os }, dryRun: false };
}

test("foundation catalog exposes only implemented Stage 1 groups", () => {
  expect(foundationTasks().map(({ id }) => id)).toEqual(["core-tools", "homebrew-packages", "shell", "git"]);
});

describe("homebrew-packages", () => {
  test("installs only a missing bundle without broad upgrades", async () => {
    const dependencies = context();
    dependencies.process.results.push(
      { exitCode: 1, stdout: "", stderr: "missing" },
      { exitCode: 0, stdout: "", stderr: "" },
    );

    await createHomebrewTask().apply(dependencies);

    expect(dependencies.process.commands.map(({ executable, args }) => [executable, ...args])).toEqual([
      ["brew", "bundle", "check", "--file", "/Users/test/.dotfiles/home/dot_Brewfile"],
      ["brew", "bundle", "install", "--file", "/Users/test/.dotfiles/home/dot_Brewfile", "--no-upgrade"],
    ]);
    expect(JSON.stringify(dependencies.process.commands)).not.toContain('"upgrade"');
  });

  test("uses sudo only for missing Ubuntu prerequisites", async () => {
    const dependencies = context("ubuntu");
    dependencies.process.whichResults.set("brew", null);
    dependencies.process.results.push(
      { exitCode: 1, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
    );

    await createHomebrewTask().apply(dependencies);

    const sudo = dependencies.process.commands.filter(({ executable }) => executable === "sudo");
    expect(sudo).toEqual([
      { executable: "sudo", args: ["apt-get", "update"] },
      { executable: "sudo", args: ["apt-get", "install", "-y", "build-essential"] },
    ]);
    expect(dependencies.process.commands.filter(({ executable }) => executable !== "sudo").every(({ executable }) => executable !== "apt-get")).toBe(true);
  });
});

test("shell asks separately before changing the Linux login shell", async () => {
  const dependencies = context("ubuntu");
  dependencies.prompts.confirmResult = true;
  dependencies.process.whichResults.set("zsh", "/home/linuxbrew/.linuxbrew/bin/zsh");

  await createShellTask().apply(dependencies);

  expect(dependencies.process.commands.at(-1)).toEqual({
    executable: "chsh",
    args: ["-s", "/home/linuxbrew/.linuxbrew/bin/zsh"],
    stdin: "inherit",
  });
});
