import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ChezmoiClient } from "../../src/chezmoi/client";
import { parseManagedTargets } from "../../src/chezmoi/targets";
import { NodeFileSystem } from "../../src/lib/filesystem";
import { FakeProcessRunner } from "../support/fakes";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function harness() {
  const root = await mkdtemp(join(tmpdir(), "dotfiles-chezmoi-client-"));
  temporaryDirectories.push(root);
  const configPath = join(root, "config", "chezmoi.json");
  const sourceDir = join(root, "repo");
  await mkdir(join(root, "config"), { recursive: true });
  await mkdir(sourceDir);
  await writeFile(configPath, JSON.stringify({ sourceDir, git: { autoCommit: true, autoPush: true } }));
  const process = new FakeProcessRunner();
  return { root, configPath, sourceDir, process, client: new ChezmoiClient({ process, fs: new NodeFileSystem(), configPath, sourceDir }) };
}

describe("ChezmoiClient", () => {
  test("parses the newline-delimited output emitted by chezmoi v2.72", () => {
    expect(parseManagedTargets(".gitconfig\n.zshrc\n")).toEqual([".gitconfig", ".zshrc"]);
  });

  test("passes explicit config/source flags and parses managed targets", async () => {
    const { client, process, configPath, sourceDir } = await harness();
    process.results.push({ exitCode: 0, stdout: "/home/yuri/.gitconfig\0/home/yuri/.zshrc\0", stderr: "" });

    await expect(client.managedTargets()).resolves.toEqual(["/home/yuri/.gitconfig", "/home/yuri/.zshrc"]);
    expect(process.commands[0]).toEqual({
      executable: "chezmoi",
      args: ["--config", configPath, "--source", sourceDir, "managed", "--nul-path-separator", "--path-style", "absolute"],
    });
  });

  test("uses dry-run apply for strict template verification", async () => {
    const { client, process, configPath, sourceDir } = await harness();
    await client.verifyTemplates();
    expect(process.commands[0]?.args).toEqual([
      "--config", configPath, "--source", sourceDir, "apply", "--dry-run", "--no-tty",
    ]);
  });

  test("renders managed files for byte-level conflict discovery", async () => {
    const { client, process, configPath, sourceDir } = await harness();
    process.results.push(
      { exitCode: 0, stdout: "/home/yuri/.gitconfig\0", stderr: "" },
      { exitCode: 0, stdout: "[user]\n", stderr: "" },
    );

    await expect(client.renderedTargets()).resolves.toEqual([{
      target: "/home/yuri/.gitconfig",
      type: "file",
      contents: new TextEncoder().encode("[user]\n"),
    }]);
    expect(process.commands).toEqual([
      {
        executable: "chezmoi",
        args: [
          "--config", configPath,
          "--source", sourceDir,
          "managed", "--include", "files", "--nul-path-separator", "--path-style", "absolute",
        ],
      },
      {
        executable: "chezmoi",
        args: ["--config", configPath, "--source", sourceDir, "cat", "/home/yuri/.gitconfig"],
      },
    ]);
  });

  test("uses an invocation-local config with Git automation disabled and removes it afterward", async () => {
    const { client, process, configPath } = await harness();
    let invocationConfig = "";
    process.onRun = async (command) => {
      invocationConfig = command.args[1] ?? "";
      const parsed = JSON.parse(await readFile(invocationConfig, "utf8")) as { git: unknown };
      expect(parsed.git).toEqual({ autoCommit: false, autoPush: false });
    };

    await client.executeWithGitDisabled("add", ["/home/yuri/.gitconfig"]);

    expect(invocationConfig).not.toBe(configPath);
    await expect(new NodeFileSystem().exists(invocationConfig)).resolves.toBe(false);
    expect(process.commands[0]?.args.slice(2, 4)).toEqual(["--source", client.sourceDir]);
  });

  test("exposes diff and apply output through non-throwing typed methods", async () => {
    const { client, process } = await harness();
    process.results.push(
      { exitCode: 0, stdout: "managed diff", stderr: "" },
      { exitCode: 0, stdout: "applied", stderr: "" },
    );

    await expect(client.diff()).resolves.toBe("managed diff");
    await expect(client.apply()).resolves.toEqual({ exitCode: 0, stdout: "applied", stderr: "" });
  });
});
