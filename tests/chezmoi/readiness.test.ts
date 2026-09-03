import { expect, test } from "bun:test";

import { assertChezmoiReady } from "../../src/chezmoi/readiness";
import { ChezmoiNotConfiguredError } from "../../src/lib/errors";
import { FakeFileSystem } from "../support/fakes";

test("reports the setup command when machine configuration is absent", async () => {
  await expect(assertChezmoiReady({
    configPath: "/Users/test/.config/chezmoi/chezmoi.json",
    expectedRepo: "/Users/test/.dotfiles",
    fs: new FakeFileSystem(),
  })).rejects.toEqual(new ChezmoiNotConfiguredError("Run `dotfiles setup` first"));
});

test("rejects a config whose sourceDir is not the expected repository", async () => {
  const configPath = "/Users/test/.config/chezmoi/chezmoi.json";
  const expectedRepo = "/Users/test/.dotfiles";
  const fs = new FakeFileSystem({
    [configPath]: JSON.stringify({ sourceDir: "/tmp/unrelated" }),
  });

  await expect(assertChezmoiReady({ configPath, expectedRepo, fs }))
    .rejects.toThrow("does not use ~/.dotfiles");
});
