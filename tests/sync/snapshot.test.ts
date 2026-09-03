import { afterEach, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LiveSnapshotService } from "../../src/sync/snapshot";
import { NodeFileSystem } from "../../src/lib/filesystem";
import { createNormalizerRegistry } from "../../src/normalizers/registry";
import type { SyncPolicyEntry } from "../../src/policy/types";

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

const entry: SyncPolicyEntry = {
  id: "zshrc",
  target: ".zshrc",
  source: "home/dot_zshrc",
  platform: ["macos"],
  classification: "managed",
  normalizer: "text-v1",
  maxBytes: 65536,
  allowedFormats: ["text"],
};

async function harness() {
  const root = await mkdtemp(join(tmpdir(), "dotfiles-snapshot-"));
  temporaryDirectories.push(root);
  const home = join(root, "home");
  const state = join(home, ".local", "state", "dotfiles");
  await mkdir(home, { recursive: true });
  return {
    home,
    state,
    service: new LiveSnapshotService({
      fs: new NodeFileSystem(),
      homeDir: home,
      stateRoot: state,
      platform: "macos",
      normalizers: createNormalizerRegistry(),
      publicSourceAllowlist: new Set<string>(),
    }),
  };
}

test("captures only registered regular files into private normalized state", async () => {
  const { home, service } = await harness();
  await writeFile(join(home, ".zshrc"), "one\r\n", { mode: 0o640 });
  await writeFile(join(home, ".ignored"), "private");

  const snapshot = await service.capture([entry]);

  expect(snapshot.entries).toHaveLength(1);
  expect(new TextDecoder().decode(snapshot.entries[0]!.contents)).toBe("one\n");
  expect((await lstat(snapshot.path)).mode & 0o777).toBe(0o700);
  expect((await lstat(join(snapshot.path, "home", "dot_zshrc"))).mode & 0o777).toBe(0o600);
  expect(await readFile(join(snapshot.path, "home", "dot_zshrc"), "utf8")).toBe("one\n");
  await snapshot.cleanup();
  await expect(lstat(snapshot.path)).rejects.toMatchObject({ code: "ENOENT" });
});

test("refuses to follow a managed symlink", async () => {
  const { home, service } = await harness();
  await writeFile(join(home, "source"), "private");
  await symlink("source", join(home, ".zshrc"));
  await expect(service.capture([entry])).rejects.toThrow("regular file");
});
