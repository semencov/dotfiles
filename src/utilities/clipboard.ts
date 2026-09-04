import { $ } from "bun";

import type { OperatingSystem } from "../lib/platform";
import { childExit, requireTools } from "./runtime";

export async function readClipboard(os: OperatingSystem): Promise<string> {
  if (os === "macos") {
    await requireTools(["pbpaste"]);
    const result = await $`pbpaste`.nothrow().quiet();
    if (result.exitCode !== 0) childExit("pbpaste", result.exitCode);
    return result.stdout.toString();
  }
  await requireTools(["xclip"]);
  const result = await $`xclip -o -selection clipboard`.nothrow().quiet();
  if (result.exitCode !== 0) childExit("xclip", result.exitCode);
  return result.stdout.toString();
}

export async function writeClipboard(value: string, os: OperatingSystem): Promise<void> {
  if (os === "macos") {
    await requireTools(["pbcopy"]);
    const result = await $`printf %s ${value} | pbcopy`.nothrow().quiet();
    if (result.exitCode !== 0) childExit("pbcopy", result.exitCode);
    return;
  }
  await requireTools(["xclip"]);
  const result = await $`printf %s ${value} | xclip -i -selection clipboard`.nothrow().quiet();
  if (result.exitCode !== 0) childExit("xclip", result.exitCode);
}
