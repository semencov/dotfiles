import { describe, expect, test } from "bun:test";

import { UnsupportedPlatformError } from "../../src/lib/errors";
import { createDotfilesPaths } from "../../src/lib/paths";
import { detectPlatform } from "../../src/lib/platform";

describe("detectPlatform", () => {
  test("detects Apple Silicon macOS", async () => {
    await expect(detectPlatform({ kernel: "darwin", architecture: "arm64", homeDir: "/Users/yuri" })).resolves.toEqual({
      os: "macos",
      arch: "arm64",
      homeDir: "/Users/yuri",
    });
  });

  test.each([
    ["ubuntu", "x86_64", "ubuntu", "x64"],
    ["debian", "aarch64", "debian", "arm64"],
  ] as const)("detects %s Linux", async (id, architecture, os, arch) => {
    await expect(detectPlatform({
      kernel: "linux",
      architecture,
      homeDir: "/home/yuri",
      osRelease: `NAME=Linux\nID=${id}\n`,
    })).resolves.toEqual({ os, arch, homeDir: "/home/yuri" });
  });

  test("rejects unsupported Linux distributions", async () => {
    await expect(detectPlatform({
      kernel: "linux",
      architecture: "x86_64",
      homeDir: "/home/yuri",
      osRelease: "NAME=Fedora\nID=fedora\n",
    })).rejects.toBeInstanceOf(UnsupportedPlatformError);
  });
});

test("createDotfilesPaths derives private state from HOME", () => {
  expect(createDotfilesPaths("/Users/yuri")).toEqual({
    repo: "/Users/yuri/.dotfiles",
    state: "/Users/yuri/.local/state/dotfiles",
    logs: "/Users/yuri/.local/state/dotfiles/logs",
    backups: "/Users/yuri/.local/state/dotfiles/backups",
    chezmoiConfig: "/Users/yuri/.config/chezmoi/chezmoi.json",
    localConfig: "/Users/yuri/.config/dotfiles/local.json",
  });
});
