import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CommandCatalog } from "../../src/utilities/catalog";

describe("CommandCatalog", () => {
  test("loads the canonical sorted command catalog", async () => {
    const catalog = await CommandCatalog.load(new URL("../../config/commands.json", import.meta.url).pathname);

    expect(catalog.commands).toHaveLength(52);
    expect(catalog.commands.map(({ name }) => name)).toEqual(
      [...catalog.commands.map(({ name }) => name)].sort(),
    );
    expect(catalog.get("dotfiles")?.summary).toBeTruthy();
  });

  test.each([
    [{ version: 1, commands: [], deleted: {}, extra: true }, "unknown or missing key"],
    [{ version: 2, commands: [], deleted: {} }, "version"],
    [{ version: 1, commands: [{ name: "bad.sh", summary: "Bad", platforms: ["macos"], externalTools: [] }], deleted: {} }, "extensionless"],
    [{ version: 1, commands: [{ name: "bad/name", summary: "Bad", platforms: ["macos"], externalTools: [] }], deleted: {} }, "extensionless"],
    [{ version: 1, commands: [{ name: "a", summary: "", platforms: ["macos"], externalTools: [] }], deleted: {} }, "summary"],
    [{ version: 1, commands: [{ name: "a", summary: "A", platforms: ["windows"], externalTools: [] }], deleted: {} }, "platform"],
    [{ version: 1, commands: [{ name: "a", summary: "A", platforms: ["macos"], externalTools: ["git", "git"] }], deleted: {} }, "external tool"],
    [{ version: 1, commands: [
      { name: "b", summary: "B", platforms: ["macos"], externalTools: [] },
      { name: "a", summary: "A", platforms: ["macos"], externalTools: [] },
    ], deleted: {} }, "sorted"],
    [{ version: 1, commands: [
      { name: "a", summary: "A", platforms: ["macos"], externalTools: [] },
      { name: "a", summary: "A", platforms: ["macos"], externalTools: [] },
    ], deleted: {} }, "duplicate command"],
  ] as const)("rejects invalid input: %s", async (value, message) => {
    const path = join(await mkdtemp(join(tmpdir(), "catalog-")), "commands.json");
    await Bun.write(path, JSON.stringify(value));
    await expect(CommandCatalog.load(path)).rejects.toThrow(message);
  });
});
