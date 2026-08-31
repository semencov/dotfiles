import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NodeFileSystem } from "../../src/lib/filesystem";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test("NodeFileSystem atomically writes text with the requested mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "dotfiles-fs-"));
  temporaryDirectories.push(root);
  const target = join(root, "config.json");
  const fs = new NodeFileSystem();

  await fs.writeTextAtomic(target, "first", 0o600);
  await fs.writeTextAtomic(target, "second", 0o600);

  expect(await readFile(target, "utf8")).toBe("second");
  expect((await stat(target)).mode & 0o777).toBe(0o600);
  expect((await fs.readdir(root)).filter((name) => name !== "config.json")).toEqual([]);
});
