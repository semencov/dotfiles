import { $ } from "bun";

import { childExit, UtilityOperationalError } from "./runtime";

export interface BranchCandidate {
  readonly name: string;
  readonly reason: "gone-upstream" | "old-and-merged";
  readonly lastCommit: number;
}

async function gitResult(cwd: string, args: readonly string[]) {
  return $`git ${args}`.cwd(cwd).nothrow().quiet();
}

export async function gitText(cwd: string, args: readonly string[], allowFailure = false): Promise<string> {
  const result = await gitResult(cwd, args);
  if (!allowFailure && result.exitCode !== 0) childExit(`git ${args[0] ?? ""}`, result.exitCode);
  return result.stdout.toString().trim();
}

export async function assertGitRepository(cwd: string): Promise<void> {
  const result = await gitResult(cwd, ["rev-parse", "--git-dir"]);
  if (result.exitCode !== 0) throw new UtilityOperationalError("Not a Git repository");
}

export async function discoverDefaultBranch(cwd: string): Promise<string> {
  await assertGitRepository(cwd);
  const symbolic = await gitText(cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], true);
  if (symbolic.startsWith("origin/")) return symbolic.slice("origin/".length);
  for (const name of ["main", "master"]) {
    const remote = await gitResult(cwd, ["rev-parse", "--verify", `refs/remotes/origin/${name}`]);
    if (remote.exitCode === 0) return name;
    const local = await gitResult(cwd, ["rev-parse", "--verify", `refs/heads/${name}`]);
    if (local.exitCode === 0) return name;
  }
  throw new UtilityOperationalError("Unable to discover the default branch");
}

export async function changedFilesSinceDefault(cwd: string, pattern?: RegExp): Promise<readonly string[]> {
  const branch = await discoverDefaultBranch(cwd);
  const remoteRef = `origin/${branch}`;
  const remoteExists = (await gitResult(cwd, ["rev-parse", "--verify", remoteRef])).exitCode === 0;
  const base = await gitText(cwd, ["merge-base", remoteExists ? remoteRef : branch, "HEAD"]);
  const output = await gitText(cwd, ["diff", "--diff-filter=ACMR", "--name-only", "-z", base]);
  return output.split("\0").filter((path) => path.length > 0 && (pattern === undefined || pattern.test(path)));
}

export async function cleanupCandidates(cwd: string, now: Date): Promise<readonly BranchCandidate[]> {
  await assertGitRepository(cwd);
  const current = await gitText(cwd, ["branch", "--show-current"]);
  const output = await gitText(cwd, [
    "for-each-ref",
    "--format=%(refname:short)%09%(upstream:track)%09%(upstream:short)%09%(committerdate:unix)",
    "refs/heads",
  ]);
  const cutoff = Math.floor(now.getTime() / 1000) - 90 * 24 * 60 * 60;
  const candidates: BranchCandidate[] = [];
  for (const line of output.split("\n").filter(Boolean)) {
    const [name, track = "", upstream = "", timestamp = "0"] = line.split("\t");
    if (name === undefined || name === current) continue;
    const localOnly = Number(await gitText(cwd, ["rev-list", name, "--not", "--remotes", "--count"]));
    if (localOnly > 0) continue;
    const lastCommit = Number(timestamp);
    if (track === "[gone]") {
      candidates.push({ name, reason: "gone-upstream", lastCommit });
      continue;
    }
    if (upstream.length === 0 || lastCommit >= cutoff) continue;
    const merged = await gitResult(cwd, ["merge-base", "--is-ancestor", name, upstream]);
    if (merged.exitCode === 0) candidates.push({ name, reason: "old-and-merged", lastCommit });
  }
  return candidates.sort((left, right) => left.name.localeCompare(right.name));
}

export function previousWorkday(now: Date): Date {
  const result = new Date(now);
  result.setUTCDate(result.getUTCDate() - (result.getUTCDay() === 1 ? 3 : 1));
  return result;
}

export function validGitHubOwner(value: string): boolean {
  return /^(?!-)[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value);
}

export function validateCommitMessage(value: string): string {
  const message = value.trim();
  if (message.length === 0) throw new UtilityOperationalError("Generated commit message is empty");
  if (message.length > 256) throw new UtilityOperationalError("Generated commit message exceeds 256 characters");
  if (/[\r\n]/.test(message)) throw new UtilityOperationalError("Generated commit message must be one line");
  return message;
}
