import { resolve } from "node:path";

import type { ProcessRunner } from "../lib/process";
import type { ConflictSide, GitStatus, MergeStartResult } from "./types";

export interface GitClientOptions {
  readonly process: ProcessRunner;
  readonly repository: string;
  readonly expectedRemote: string;
  readonly branch: string;
}

export class GitClientError extends Error {
  public constructor(operation: string, public readonly exitCode = 1) {
    super(`Git ${operation} failed`);
    this.name = "GitClientError";
  }
}

function nulPaths(value: string): readonly string[] {
  return value.split("\0").filter((path) => path.length > 0);
}

export class GitClient {
  readonly #process: ProcessRunner;
  readonly #repository: string;
  readonly #expectedRemote: string;
  readonly #branch: string;

  public constructor(options: GitClientOptions) {
    this.#process = options.process;
    this.#repository = resolve(options.repository);
    this.#expectedRemote = options.expectedRemote;
    this.#branch = options.branch;
  }

  public async assertExpectedRepository(): Promise<void> {
    const root = await this.#run("resolve repository", ["rev-parse", "--show-toplevel"]);
    if (resolve(root.stdout.trim()) !== this.#repository) throw new GitClientError("repository root validation");
    const remote = await this.#run("read origin", ["remote", "get-url", "origin"]);
    if (remote.stdout.trim() !== this.#expectedRemote) throw new GitClientError("origin validation");
    const branch = await this.#run("read branch", ["branch", "--show-current"]);
    if (branch.stdout.trim() !== this.#branch) throw new GitClientError("branch validation");
  }

  public async status(): Promise<GitStatus> {
    const result = await this.#run("status", ["status", "--porcelain=v2", "--branch", "--untracked-files=all"]);
    const divergence = result.stdout.match(/^# branch\.ab \+(\d+) -(\d+)$/m);
    const dirty = result.stdout.split("\n").some((line) => line.length > 0 && !line.startsWith("#"));
    return {
      clean: !dirty,
      ahead: Number(divergence?.[1] ?? 0),
      behind: Number(divergence?.[2] ?? 0),
    };
  }

  public async stagedPaths(): Promise<readonly string[]> {
    return nulPaths((await this.#run("list staged paths", ["diff", "--cached", "--name-only", "-z"])).stdout);
  }

  public async fetch(): Promise<void> {
    await this.#run("fetch", ["fetch", "origin", this.#branch]);
  }

  public async beginMergeWithoutCommit(): Promise<MergeStartResult> {
    const result = await this.#process.run({
      executable: "git",
      args: ["-C", this.#repository, "merge", "--no-ff", "--no-commit", `origin/${this.#branch}`],
    });
    if (result.exitCode !== 0) return "conflicted";
    return /already up[ -]to[ -]date/i.test(result.stdout) ? "unchanged" : "merged";
  }

  public async conflicts(): Promise<readonly string[]> {
    return nulPaths((await this.#run("list conflicts", ["diff", "--name-only", "--diff-filter=U", "-z"])).stdout);
  }

  public async checkoutConflictSide(side: ConflictSide, paths: readonly string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.#run(`checkout ${side}`, ["checkout", `--${side}`, "--", ...paths]);
  }

  public async stage(paths: readonly string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.#run("stage", ["add", "--", ...paths]);
  }

  public async commit(message: string): Promise<void> {
    if (message.trim().length === 0) throw new GitClientError("commit message validation");
    await this.#run("commit", ["commit", "-m", message]);
  }

  public async push(): Promise<void> {
    await this.#run("push", ["push", "origin", `HEAD:${this.#branch}`]);
  }

  public async abortMerge(): Promise<void> {
    await this.#run("abort merge", ["merge", "--abort"]);
  }

  public async hooksPath(): Promise<string> {
    return (await this.#run("read hooks path", ["config", "--get", "core.hooksPath"])).stdout.trim();
  }

  public async head(): Promise<string> {
    return (await this.#run("read HEAD", ["rev-parse", "HEAD"])).stdout.trim();
  }

  async #run(operation: string, args: readonly string[]) {
    const result = await this.#process.run({ executable: "git", args: ["-C", this.#repository, ...args] });
    if (result.exitCode !== 0) throw new GitClientError(operation, result.exitCode);
    return result;
  }
}
