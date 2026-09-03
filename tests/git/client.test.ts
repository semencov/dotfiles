import { describe, expect, test } from "bun:test";

import { GitClient, GitClientError } from "../../src/git/client";
import { FakeProcessRunner } from "../support/fakes";

const repository = "/Users/test/.dotfiles";
const expectedRemote = "https://github.com/semencov/dotfiles.git";

function client(process = new FakeProcessRunner()): GitClient {
  return new GitClient({ process, repository, expectedRemote, branch: "master" });
}

describe("GitClient", () => {
  test("validates repository root, exact remote, and branch", async () => {
    const process = new FakeProcessRunner();
    process.results.push(
      { exitCode: 0, stdout: `${repository}\n`, stderr: "" },
      { exitCode: 0, stdout: `${expectedRemote}\n`, stderr: "" },
      { exitCode: 0, stdout: "master\n", stderr: "" },
    );

    await expect(client(process).assertExpectedRepository()).resolves.toBeUndefined();
    expect(process.commands.map(({ args }) => args)).toEqual([
      ["-C", repository, "rev-parse", "--show-toplevel"],
      ["-C", repository, "remote", "get-url", "origin"],
      ["-C", repository, "branch", "--show-current"],
    ]);
  });

  test("rejects an unexpected remote", async () => {
    const process = new FakeProcessRunner();
    process.results.push(
      { exitCode: 0, stdout: `${repository}\n`, stderr: "" },
      { exitCode: 0, stdout: "git@github.com:other/repo.git\n", stderr: "" },
    );

    await expect(client(process).assertExpectedRepository()).rejects.toBeInstanceOf(GitClientError);
  });

  test("parses dirty and ahead/behind status plus NUL-delimited paths", async () => {
    const process = new FakeProcessRunner();
    process.results.push(
      { exitCode: 0, stdout: "# branch.oid abc\n# branch.head master\n# branch.ab +2 -3\n1 .M N... home/dot_zshrc\n", stderr: "" },
      { exitCode: 0, stdout: "home/dot_zshrc\0docs/setup.md\0", stderr: "" },
      { exitCode: 0, stdout: "home/dot_gitconfig\0", stderr: "" },
    );

    await expect(client(process).status()).resolves.toEqual({ clean: false, ahead: 2, behind: 3 });
    await expect(client(process).stagedPaths()).resolves.toEqual(["home/dot_zshrc", "docs/setup.md"]);
    await expect(client(process).conflicts()).resolves.toEqual(["home/dot_gitconfig"]);
  });

  test("uses a normal no-rewrite upstream merge and detects unchanged state", async () => {
    const process = new FakeProcessRunner();
    process.results.push({ exitCode: 0, stdout: "Already up to date.\n", stderr: "" });

    await expect(client(process).beginMergeWithoutCommit()).resolves.toBe("unchanged");
    expect(process.commands[0]?.args).toEqual([
      "-C", repository, "merge", "--no-ff", "--no-commit", "origin/master",
    ]);
  });

  test("constructs exact fetch, conflict, stage, commit, push, hook, and head operations", async () => {
    const process = new FakeProcessRunner();
    process.results.push(...Array.from({ length: 9 }, () => ({ exitCode: 0, stdout: "abc\n", stderr: "" })));
    const git = client(process);

    await git.fetch();
    await git.checkoutConflictSide("theirs", ["home/dot_zshrc"]);
    await git.stage(["home/dot_zshrc"]);
    await git.commit("sync: managed state");
    await git.push();
    await git.abortMerge();
    await expect(git.hooksPath()).resolves.toBe("abc");
    await expect(git.head()).resolves.toBe("abc");

    expect(process.commands.map(({ args }) => args)).toEqual([
      ["-C", repository, "fetch", "origin", "master"],
      ["-C", repository, "checkout", "--theirs", "--", "home/dot_zshrc"],
      ["-C", repository, "add", "--", "home/dot_zshrc"],
      ["-C", repository, "commit", "-m", "sync: managed state"],
      ["-C", repository, "push", "origin", "HEAD:master"],
      ["-C", repository, "merge", "--abort"],
      ["-C", repository, "config", "--get", "core.hooksPath"],
      ["-C", repository, "rev-parse", "HEAD"],
    ]);
  });
});
