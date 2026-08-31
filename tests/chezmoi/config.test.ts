import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { BackupService } from "../../src/backups/service";
import {
  installChezmoiConfiguration,
  serializeChezmoiConfig,
  validateSourceRepository,
  type MachineConfig,
} from "../../src/chezmoi/config";
import { NodeFileSystem } from "../../src/lib/filesystem";
import { createDotfilesPaths } from "../../src/lib/paths";
import { FakeLogger } from "../support/fakes";

const temporaryDirectories: string[] = [];

async function temporaryHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "dotfiles-chezmoi-config-"));
  temporaryDirectories.push(home);
  return home;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function machine(sourceDir: string): MachineConfig {
  return {
    version: 1,
    sourceDir,
    platform: "macos",
    selectedTasks: ["core-tools", "shell"],
    git: { autoCommit: true, autoPush: true },
  };
}

test("serializeChezmoiConfig emits the exact strict file-mode JSON", () => {
  expect(JSON.parse(serializeChezmoiConfig(machine("/Users/yuri/.dotfiles")))).toEqual({
    sourceDir: "/Users/yuri/.dotfiles",
    mode: "file",
    template: { options: ["missingkey=error"] },
    git: { autoCommit: true, autoPush: true },
    data: {
      dotfiles: {
        version: 1,
        platform: "macos",
        selectedTasks: ["core-tools", "shell"],
      },
    },
  });
});

describe("validateSourceRepository", () => {
  test("rejects a source directory other than the expected ~/.dotfiles checkout", async () => {
    const home = await temporaryHome();
    const paths = createDotfilesPaths(home);
    await mkdir(paths.repo, { recursive: true });
    await writeFile(join(paths.repo, ".chezmoiroot"), "home\n");
    const unrelated = join(home, "unrelated");
    await mkdir(unrelated);

    await expect(validateSourceRepository(unrelated, paths.repo, new NodeFileSystem())).rejects.toThrow(
      "does not match the expected repository",
    );
  });
});

test("installChezmoiConfiguration archives legacy config/state and leaves stale source state untouched", async () => {
  const home = await temporaryHome();
  const paths = createDotfilesPaths(home);
  const fs = new NodeFileSystem();
  const logger = new FakeLogger();
  await mkdir(paths.repo, { recursive: true });
  await writeFile(join(paths.repo, ".chezmoiroot"), "home\n");
  await mkdir(dirname(paths.chezmoiConfig), { recursive: true });
  await writeFile(join(dirname(paths.chezmoiConfig), "chezmoi.toml"), "sourceDir = 'old'\n");
  await writeFile(join(dirname(paths.chezmoiConfig), "chezmoistate.boltdb"), "state");
  const staleSource = join(home, ".local", "share", "chezmoi");
  await mkdir(staleSource, { recursive: true });
  await writeFile(join(staleSource, "dot_zshrc"), "stale but preserved");
  const backups = new BackupService({
    fs,
    homeDir: home,
    backupRoot: paths.backups,
    now: () => new Date("2026-08-31T06:07:08.000Z"),
  });

  const result = await installChezmoiConfiguration({
    machine: machine(paths.repo),
    expectedRepo: paths.repo,
    homeDir: home,
    configPath: paths.chezmoiConfig,
    fs,
    backups,
    logger,
  });

  expect(result.archive?.manifest.entries.map(({ relativePath }) => relativePath)).toEqual([
    ".config/chezmoi/chezmoi.toml",
    ".config/chezmoi/chezmoistate.boltdb",
  ]);
  expect(JSON.parse(await readFile(paths.chezmoiConfig, "utf8"))).toEqual(JSON.parse(serializeChezmoiConfig(machine(paths.repo))));
  expect((await stat(paths.chezmoiConfig)).mode & 0o777).toBe(0o600);
  expect(await readFile(join(staleSource, "dot_zshrc"), "utf8")).toBe("stale but preserved");
  expect(JSON.stringify(logger.entries)).toContain(staleSource);
});

test("installChezmoiConfiguration preserves current chezmoi state on rerun", async () => {
  const home = await temporaryHome();
  const paths = createDotfilesPaths(home);
  const fs = new NodeFileSystem();
  await mkdir(paths.repo, { recursive: true });
  await writeFile(join(paths.repo, ".chezmoiroot"), "home\n");
  await mkdir(dirname(paths.chezmoiConfig), { recursive: true });
  await writeFile(paths.chezmoiConfig, serializeChezmoiConfig(machine(paths.repo)), { mode: 0o600 });
  const state = join(dirname(paths.chezmoiConfig), "chezmoistate.boltdb");
  await writeFile(state, "current state");

  const result = await installChezmoiConfiguration({
    machine: machine(paths.repo),
    expectedRepo: paths.repo,
    homeDir: home,
    configPath: paths.chezmoiConfig,
    fs,
    backups: new BackupService({ fs, homeDir: home, backupRoot: paths.backups }),
    logger: new FakeLogger(),
  });

  expect(result.archive).toBeNull();
  expect(await readFile(state, "utf8")).toBe("current state");
});
