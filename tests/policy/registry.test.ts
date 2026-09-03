import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { PolicyRegistry } from "../../src/policy/registry";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function policyFile(value: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dotfiles-policy-"));
  temporaryDirectories.push(root);
  const path = join(root, "policy.json");
  await writeFile(path, JSON.stringify(value));
  return path;
}

const entry = {
  id: "zshrc",
  target: ".zshrc",
  source: "home/dot_zshrc",
  platform: ["macos", "ubuntu", "debian"],
  classification: "managed",
  normalizer: "text-v1",
  maxBytes: 65536,
  allowedFormats: ["text"],
};

describe("PolicyRegistry", () => {
  test("loads the canonical repository policy", async () => {
    const registry = await PolicyRegistry.load(resolve(import.meta.dir, "../../config/sync-policy.json"));

    expect(registry.version).toBe(1);
    expect(registry.entries.length).toBeGreaterThan(10);
    expect(registry.entries.map(({ id }) => id)).toEqual(registry.entries.map(({ id }) => id).sort());
    expect(registry.forPlatform("ubuntu").every(({ platform }) => platform.includes("ubuntu"))).toBe(true);
    expect(registry.getByTarget(".zshrc")?.source).toBe("home/dot_zshrc");
  });

  test("rejects unknown keys, duplicates, traversal, unknown normalizers, and noncanonical order", async () => {
    const cases: readonly [string, unknown][] = [
      ["unknown top-level key", { version: 1, repositoryPaths: ["home"], entries: [entry], extra: true }],
      ["duplicate target", { version: 1, repositoryPaths: ["home"], entries: [entry, { ...entry, id: "other" }] }],
      ["source traversal", { version: 1, repositoryPaths: ["home"], entries: [{ ...entry, source: "../secret" }] }],
      ["unknown normalizer", { version: 1, repositoryPaths: ["home"], entries: [{ ...entry, normalizer: "guess-v1" }] }],
      ["unsorted entries", { version: 1, repositoryPaths: ["home"], entries: [{ ...entry, id: "z" }, { ...entry, id: "a", target: ".a", source: "home/a" }] }],
    ];

    for (const [name, value] of cases) {
      await expect(PolicyRegistry.load(await policyFile(value)), name).rejects.toThrow();
    }
  });
});
