import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repository = new URL("../..", import.meta.url).pathname;

test("npm completion helper is extensionless typed Bun", async () => {
  const helper = join(repository, "zsh", "plugins", "npm-scripts", "get-scripts");
  expect(await Bun.file(helper).exists()).toBe(true);
  expect(await Bun.file(helper).text()).toStartWith("#!/usr/bin/env bun\n");
  const root = await mkdtemp(join(tmpdir(), "npm-scripts-"));
  const packageJson = join(root, "package.json");
  await Bun.write(packageJson, JSON.stringify({ scripts: { build: "bun build src", "x:y": "echo $VALUE" } }));
  const child = Bun.spawn([helper, packageJson], { stdout: "pipe", stderr: "pipe" });
  expect(await child.exited).toBe(0);
  expect(await new Response(child.stdout).text()).toBe("build:$ bun build src\nx\\:y:$ echo \\$VALUE\n");
});
