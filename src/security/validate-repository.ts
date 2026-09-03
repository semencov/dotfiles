import type { ProcessRunner } from "../lib/process";
import type { PolicyRegistry } from "../policy/registry";
import { isContainedRepositoryPath, validateManagedBlob } from "./file-rules";
import { scanSecrets, type SecurityFinding } from "./secret-rules";

export type RepositoryValidationMode =
  | { readonly kind: "staged" }
  | { readonly kind: "tree"; readonly ref: string };

export interface ValidateRepositoryOptions {
  readonly repository: string;
  readonly policy: PolicyRegistry;
  readonly process: ProcessRunner;
  readonly mode: RepositoryValidationMode;
}

function paths(value: string): readonly string[] {
  return value.split("\0").filter(Boolean);
}

function allowedByRoot(path: string, roots: readonly string[]): boolean {
  return roots.some((root) => path === root || path.startsWith(`${root}/`));
}

export async function validateRepository(options: ValidateRepositoryOptions): Promise<readonly SecurityFinding[]> {
  const listArgs = options.mode.kind === "staged"
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
    : ["ls-tree", "-r", "--name-only", "-z", options.mode.ref];
  const listed = await options.process.run({ executable: "git", args: ["-C", options.repository, ...listArgs] });
  if (listed.exitCode !== 0) return [{ rule: "git-path-list-failed", path: "." }];

  const findings: SecurityFinding[] = [];
  for (const path of paths(listed.stdout)) {
    if (!isContainedRepositoryPath(path) || !allowedByRoot(path, options.policy.repositoryPaths)) {
      findings.push({ rule: "path-unregistered", path });
      continue;
    }
    const entry = options.policy.entries.find(({ source }) => source === path);
    if (path.startsWith("home/") && entry === undefined) {
      findings.push({ rule: "path-unregistered", path });
      continue;
    }

    const object = options.mode.kind === "staged" ? `:${path}` : `${options.mode.ref}:${path}`;
    const blob = await options.process.run({
      executable: "git",
      args: ["-C", options.repository, "show", object],
    });
    if (blob.exitCode !== 0) {
      findings.push({ rule: "blob-unreadable", path });
      continue;
    }
    if (entry !== undefined) findings.push(...validateManagedBlob(path, blob.stdout, entry));
    findings.push(...scanSecrets(path, blob.stdout));
  }
  return findings;
}
