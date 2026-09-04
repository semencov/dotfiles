import { expect, test } from "bun:test";
import { join } from "node:path";

const repo = new URL("../..", import.meta.url).pathname;

test("obsolete runtime packages and programs are absent", async () => {
  const packageJson: unknown = JSON.parse(await Bun.file(join(repo, "package.json")).text());
  expect(packageJson).toBeObject();
  const dependencies = (packageJson as { dependencies?: Record<string, string> }).dependencies ?? {};
  for (const name of ["zx", "ora", "open", "pretty-bytes-cli", "diff-so-fancy"]) expect(dependencies[name]).toBeUndefined();
  for (const name of ["backup", "emptytrash", "help.mjs", "ip-wan.mjs", "spinningPromise.mjs", "update", "update.mjs"]) {
    expect(await Bun.file(join(repo, "bin", name)).exists(), name).toBe(false);
  }
  expect(await Bun.file(join(repo, "setup", "node.sh")).text()).not.toContain("  zx \\\n");
});

test("Zsh contains only sourced modules and one Bun completion helper", async () => {
  const glob = new Bun.Glob("zsh/**/*");
  for await (const relative of glob.scan({ cwd: repo, onlyFiles: true })) {
    const path = join(repo, relative);
    if (relative === "zsh/plugins/npm-scripts/get-scripts") {
      expect(await Bun.file(path).text()).toStartWith("#!/usr/bin/env bun\n");
      continue;
    }
    expect(relative.endsWith(".cjs") || relative.endsWith(".js") || relative.endsWith(".mjs"), relative).toBe(false);
  }
});
