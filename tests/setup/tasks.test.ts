import { describe, expect, test } from "bun:test";

import { foundationTasks } from "../../src/setup/catalog";
import { createHomebrewTask } from "../../src/setup/tasks/homebrew";
import { createShellTask } from "../../src/setup/tasks/shell";
import type { TaskContext } from "../../src/setup/types";
import { createFakeDependencies } from "../support/fakes";

function context(os: "macos" | "ubuntu" | "debian" = "macos"): TaskContext & ReturnType<typeof createFakeDependencies> {
  const dependencies = createFakeDependencies();
  return { ...dependencies, platform: { ...dependencies.platform, os }, dryRun: false, nonInteractive: false };
}

test("foundation catalog exposes only implemented Stage 1 groups", () => {
  const tasks = foundationTasks();
  expect(tasks.map(({ id }) => id)).toEqual(["core-tools", "homebrew-packages", "shell", "git"]);
  expect(tasks.every(({ platforms }) => platforms.includes("debian"))).toBe(true);
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
      { exitCode: 0, stdout: "install ok installed", stderr: "" },
      { exitCode: 0, stdout: "install ok installed", stderr: "" },
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

  test("uses the Linuxbrew prefix on Debian", async () => {
    const dependencies = context("debian");
    dependencies.process.whichResults.set("brew", null);
    dependencies.process.results.push(
      { exitCode: 0, stdout: "install ok installed", stderr: "" },
      { exitCode: 0, stdout: "install ok installed", stderr: "" },
      { exitCode: 0, stdout: "install ok installed", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
    );

    await createHomebrewTask().apply(dependencies);

    expect(dependencies.process.commands.at(-1)?.executable).toBe("/home/linuxbrew/.linuxbrew/bin/brew");
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

test("shell never changes the Linux login shell non-interactively", async () => {
  const dependencies = { ...context("ubuntu"), nonInteractive: true };
  dependencies.process.whichResults.set("zsh", "/home/linuxbrew/.linuxbrew/bin/zsh");

  await createShellTask().apply(dependencies);

  expect(dependencies.process.commands).toEqual([]);
});
