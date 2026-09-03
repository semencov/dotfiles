import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BackupService, discoverChezmoiConflicts } from "../../src/backups/service";
import { NodeFileSystem } from "../../src/lib/filesystem";

const temporaryDirectories: string[] = [];

async function temporaryHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "dotfiles-backup-"));
  temporaryDirectories.push(home);
  return home;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("BackupService", () => {
  test("moves files, directories, and symlinks into a private relative-path archive", async () => {
    const home = await temporaryHome();
    const external = await mkdtemp(join(tmpdir(), "dotfiles-backup-external-"));
    temporaryDirectories.push(external);
    await mkdir(join(home, ".config", "tool"), { recursive: true });
    await writeFile(join(home, ".config", "tool", "config"), "old", { mode: 0o640 });
    await mkdir(join(home, ".legacy"), { mode: 0o750 });
    await writeFile(join(home, ".legacy", "state"), "preserve");
    await writeFile(join(external, "zshrc"), "external");
    await symlink(join(external, "zshrc"), join(home, ".zshrc"));
    const targets = [
      { target: join(home, ".config", "tool", "config"), type: "file" as const, contents: new TextEncoder().encode("new") },
      { target: join(home, ".legacy"), type: "file" as const, contents: new TextEncoder().encode("replacement") },
      { target: join(home, ".zshrc"), type: "file" as const, contents: new TextEncoder().encode("managed") },
    ];
    const fs = new NodeFileSystem();
    const conflicts = await discoverChezmoiConflicts(targets, fs, home);
    const service = new BackupService({
      fs,
      homeDir: home,
      backupRoot: join(home, ".local", "state", "dotfiles", "backups"),
      now: () => new Date("2026-08-31T06:07:08.000Z"),
    });

    const archive = await service.archive(conflicts);

    expect(archive?.id).toBe("20260831T060708Z");
    expect(archive?.manifest.entries.map(({ relativePath, type, reason }) => ({ relativePath, type, reason }))).toEqual([
      { relativePath: ".config/tool/config", type: "file", reason: "chezmoi-conflict" },
      { relativePath: ".legacy", type: "directory", reason: "chezmoi-conflict" },
      { relativePath: ".zshrc", type: "symlink", reason: "legacy-symlink" },
    ]);
    expect(await lstat(join(archive!.path, ".zshrc")).then((value) => value.isSymbolicLink())).toBe(true);
    expect(await readFile(join(archive!.path, ".legacy", "state"), "utf8")).toBe("preserve");
    expect((await stat(archive!.path)).mode & 0o777).toBe(0o700);
    expect((await stat(join(archive!.path, "manifest.json"))).mode & 0o777).toBe(0o600);
    expect(archive?.manifest.entries[0]?.mode).toBe(0o640);
  });

  test("does not classify byte-identical regular files as conflicts", async () => {
    const home = await temporaryHome();
    const target = join(home, ".gitconfig");
    await writeFile(target, "same");

    const conflicts = await discoverChezmoiConflicts([
      { target, type: "file", contents: new TextEncoder().encode("same") },
    ], new NodeFileSystem(), home);

    expect(conflicts).toEqual([]);
  });

  test("archives a legacy directory symlink once without adding managed descendants", async () => {
    const home = await temporaryHome();
    const source = join(home, ".dotfiles", "home", "dot_mackup");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "tool.cfg"), "legacy");
    await symlink(source, join(home, ".mackup"));

    const conflicts = await discoverChezmoiConflicts([
      {
        target: join(home, ".mackup", "tool.cfg"),
        type: "file",
        contents: new TextEncoder().encode("managed"),
      },
      { target: join(home, ".mackup"), type: "directory" },
    ], new NodeFileSystem(), home);

    expect(conflicts.map(({ relativePath, type }) => ({ relativePath, type }))).toEqual([
      { relativePath: ".mackup", type: "symlink" },
    ]);
  });

  test("allocates distinct archives for multiple conflicts in the same second", async () => {
    const home = await temporaryHome();
    const fs = new NodeFileSystem();
    const backupRoot = join(home, ".local", "state", "dotfiles", "backups");
    const service = new BackupService({
      fs,
      homeDir: home,
      backupRoot,
      now: () => new Date("2026-08-31T06:07:08.000Z"),
    });
    const first = join(home, ".first");
    const second = join(home, ".second");
    await writeFile(first, "first");
    await writeFile(second, "second");

    const firstArchive = await service.archive([{
      source: first,
      relativePath: ".first",
      type: "file",
      mode: 0o644,
      reason: "chezmoi-conflict",
    }]);
    const secondArchive = await service.archive([{
      source: second,
      relativePath: ".second",
      type: "file",
      mode: 0o644,
      reason: "chezmoi-conflict",
    }]);

    expect(firstArchive?.id).toBe("20260831T060708Z");
    expect(secondArchive?.id).toBe("20260831T060708Z-2");
  });

  test("rejects paths outside HOME before creating an archive", async () => {
    const home = await temporaryHome();
    const outside = await mkdtemp(join(tmpdir(), "dotfiles-outside-"));
    temporaryDirectories.push(outside);
    const target = join(outside, "config");
    await writeFile(target, "private");
    const fs = new NodeFileSystem();

    await expect(discoverChezmoiConflicts([
      { target, type: "file", contents: new TextEncoder().encode("managed") },
    ], fs, home)).rejects.toThrow("outside HOME");
    await expect(fs.exists(join(home, ".local", "state", "dotfiles", "backups"))).resolves.toBe(false);
  });

  test("rejects a lexically contained source whose parent symlink resolves outside HOME", async () => {
    const home = await temporaryHome();
    const outside = await mkdtemp(join(tmpdir(), "dotfiles-realpath-outside-"));
    temporaryDirectories.push(outside);
    await writeFile(join(outside, "config"), "private");
    await symlink(outside, join(home, ".escaped"));

    await expect(discoverChezmoiConflicts([
      {
        target: join(home, ".escaped", "config"),
        type: "file",
        contents: new TextEncoder().encode("managed"),
      },
    ], new NodeFileSystem(), home)).rejects.toThrow("parent resolves outside HOME");
  });
});
