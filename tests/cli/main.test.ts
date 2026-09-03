import { describe, expect, test } from "bun:test";
import { createProgram, runCli } from "../../src/cli/main";
import { createFakeDependencies } from "../support/fakes";

describe("createProgram", () => {
  test("registers the Stage 1 foundation commands", () => {
    const program = createProgram(createFakeDependencies());

    expect(program.commands.map((command) => command.name())).toEqual([
      "setup",
      "apply",
      "edit",
      "sync",
      "internal",
    ]);
  });

  test("returns a non-zero exit code for an unknown command without running a process", async () => {
    const dependencies = createFakeDependencies();

    await expect(runCli(["node", "dotfiles", "unknown"], dependencies)).resolves.toBe(1);
    expect(dependencies.process.commands).toEqual([]);
  });
});
