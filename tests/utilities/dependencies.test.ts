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
});
