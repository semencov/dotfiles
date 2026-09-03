import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GitClient } from "../../src/git/client";
import type { Logger } from "../../src/lib/logger";
import { BunProcessRunner } from "../../src/lib/process";
import { runSyncTransaction } from "../../src/sync/service";
import type { LiveSnapshot } from "../../src/sync/types";

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

const logger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };
const runner = new BunProcessRunner(logger);

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runner.run({ executable: "git", args: ["-C", cwd, ...args] });
  if (result.exitCode !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

test("stale clone sync preserves remote history while its later live snapshot wins", async () => {
  const root = await mkdtemp(join(tmpdir(), "dotfiles-sync-git-"));
  temporaryDirectories.push(root);
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const cloneA = join(root, "a");
  const cloneB = join(root, "b");
  await mkdir(seed);
  await git(seed, ["init", "-b", "master"]);
  await git(seed, ["config", "user.name", "Synthetic"]);
  await git(seed, ["config", "user.email", "synthetic@example.invalid"]);
  await mkdir(join(seed, "home"));
  await writeFile(join(seed, "home", "dot_zshrc"), "base\n");
  await git(seed, ["add", "home/dot_zshrc"]);
  await git(seed, ["commit", "-m", "base"]);
  await runner.run({ executable: "git", args: ["init", "--bare", remote] });
  await git(seed, ["remote", "add", "origin", remote]);
  await git(seed, ["push", "-u", "origin", "master"]);
  await runner.run({ executable: "git", args: ["clone", remote, cloneA] });
  await runner.run({ executable: "git", args: ["clone", remote, cloneB] });
  for (const clone of [cloneA, cloneB]) {
    await git(clone, ["config", "user.name", "Synthetic"]);
    await git(clone, ["config", "user.email", "synthetic@example.invalid"]);
  }

  await writeFile(join(cloneB, "home", "dot_zshrc"), "remote\n");
  await git(cloneB, ["commit", "-am", "remote change"]);
  const remoteCommit = await git(cloneB, ["rev-parse", "HEAD"]);
  await git(cloneB, ["push"]);

  const client = new GitClient({ process: runner, repository: cloneA, expectedRemote: remote, branch: "master" });
  const snapshot: LiveSnapshot = { path: join(root, "snapshot"), entries: [], cleanup: async () => undefined };
  const result = await runSyncTransaction({ push: true, dryRun: false, message: "sync live state" }, {
    assertPreconditions: async () => expect((await client.status()).clean).toBe(true),
    capture: async () => snapshot,
    fetch: () => client.fetch(),
    merge: () => client.beginMergeWithoutCommit(),
    resolveRegisteredConflicts: async () => expect(await client.conflicts()).toEqual([]),
    applySnapshot: async () => {
      await writeFile(join(cloneA, "home", "dot_zshrc"), "local-live\n");
      await client.stage(["home/dot_zshrc"]);
      return ["home/dot_zshrc"];
    },
    validate: async () => undefined,
    commit: async (message) => { await client.commit(message); return client.head(); },
    push: () => client.push(),
    abortMerge: () => client.abortMerge(),
  });

  expect(result.pushed).toBe(true);
  expect(await readFile(join(cloneA, "home", "dot_zshrc"), "utf8")).toBe("local-live\n");
  expect((await git(cloneA, ["merge-base", "--is-ancestor", remoteCommit, "HEAD"]).then(() => true))).toBe(true);
  expect(await git(cloneA, ["rev-list", "--count", "--merges", "HEAD"])).toBe("1");
});
