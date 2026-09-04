import { expect, test } from "bun:test";
import { join } from "node:path";

const bin = join(new URL("../..", import.meta.url).pathname, "bin");

async function command(name: string, args: readonly string[]) {
  const process = Bun.spawn([join(bin, name), ...args], { stdout: "pipe", stderr: "pipe" });
  return {
    exitCode: await process.exited,
    stdout: await new Response(process.stdout).text(),
    stderr: await new Response(process.stderr).text(),
  };
}

test("codepoint and escape handle literal Unicode", async () => {
  expect(await command("codepoint", ["£"])).toEqual({ exitCode: 0, stdout: "\\x00A3\n", stderr: "" });
  expect(await command("escape", ["£"])).toEqual({ exitCode: 0, stdout: "\\xC2\\xA3\n", stderr: "" });
});

test("passphrase emits the requested number of words", async () => {
  const result = await command("passphrase", ["--words", "4"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toMatch(/^[a-z]+(?:-[a-z]+){3}\n$/);
});

test("every migrated text command exposes help without side effects", async () => {
  for (const name of [
    "codepoint", "confirm", "crlf", "escape", "extract", "gz", "lso", "passphrase",
    "pem", "pk", "rename", "resetperm", "wg", "zsh_history_fix",
  ]) {
    const result = await command(name, ["--help"]);
    expect(result.exitCode, name).toBe(0);
    expect(result.stdout, name).toContain("Usage:");
  }
});
