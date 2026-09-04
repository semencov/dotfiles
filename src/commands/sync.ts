import { join } from "node:path";

import { ChezmoiClient } from "../chezmoi/client";
import { assertChezmoiReady } from "../chezmoi/readiness";
import type { CliDependencies, SyncCommandOptions } from "../cli/dependencies";
import { GitClient } from "../git/client";
import { createNormalizerRegistry } from "../normalizers/registry";
import { PolicyRegistry } from "../policy/registry";
import { validateRepository } from "../security/validate-repository";
import { runSyncTransaction, type SyncTransactionServices } from "../sync/service";
import { LiveSnapshotService } from "../sync/snapshot";
import type { LiveSnapshot } from "../sync/types";

const EXPECTED_REMOTE = "https://github.com/semencov/dotfiles.git";
const DEFAULT_BRANCH = "master";

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

export async function createSyncServices(dependencies: CliDependencies): Promise<SyncTransactionServices> {
  const policy = await PolicyRegistry.load(join(dependencies.paths.repo, "config", "sync-policy.json"));
  const git = new GitClient({
    process: dependencies.process,
    repository: dependencies.paths.repo,
    expectedRemote: EXPECTED_REMOTE,
    branch: DEFAULT_BRANCH,
  });
  const snapshotService = new LiveSnapshotService({
    fs: dependencies.fs,
    homeDir: dependencies.platform.homeDir,
    stateRoot: dependencies.paths.state,
    platform: dependencies.platform.os,
    normalizers: createNormalizerRegistry(),
    publicSourceAllowlist: new Set(["https://registry.npmjs.org", "https://github.com", "https://formulae.brew.sh"]),
  });
  const chezmoi = new ChezmoiClient({
    process: dependencies.process,
    fs: dependencies.fs,
    configPath: dependencies.paths.chezmoiConfig,
    sourceDir: dependencies.paths.repo,
  });
  let changedSources: readonly string[] = [];

  return {
    assertPreconditions: async () => {
      await assertChezmoiReady({
        configPath: dependencies.paths.chezmoiConfig,
        expectedRepo: dependencies.paths.repo,
        fs: dependencies.fs,
      });
      await git.assertExpectedRepository();
      const status = await git.status();
      if (!status.clean) {
        throw new Error(`Repository must be clean before sync: ${(await git.worktreePaths()).join(", ")}`);
      }
      if (await git.hooksPath() !== ".githooks") throw new Error("Repository hooks are not configured; run `dotfiles setup`");
    },
    capture: () => snapshotService.capture(policy.entries),
    fetch: () => git.fetch(),
    merge: () => git.beginMergeWithoutCommit(),
    resolveRegisteredConflicts: async () => {
      const conflicts = await git.conflicts();
      const allowed = new Set(policy.entries.filter(({ classification }) => classification === "managed").map(({ source }) => source));
      const blocked = conflicts.filter((path) => !allowed.has(path));
      if (blocked.length > 0) throw new Error(`Sync stopped on non-managed conflicts: ${blocked.join(", ")}`);
      await git.checkoutConflictSide("theirs", conflicts);
      await git.stage(conflicts);
    },
    applySnapshot: async (snapshot: LiveSnapshot, dryRun: boolean) => {
      const changed: string[] = [];
      for (const entry of snapshot.entries) {
        const source = join(dependencies.paths.repo, entry.policy.source);
        const current = await dependencies.fs.exists(source) ? await dependencies.fs.readBytes(source) : null;
        if (current !== null && sameBytes(current, entry.contents)) continue;
        changed.push(entry.policy.source);
        if (!dryRun) await dependencies.fs.writeBytesAtomic(source, entry.contents, 0o644);
      }
      changedSources = changed;
      if (!dryRun) await git.stage(changed);
      return changed;
    },
    stageChanges: (sources: readonly string[]) => git.stage(sources),
    validate: async () => {
      const findings = await validateRepository({
        repository: dependencies.paths.repo,
        policy,
        process: dependencies.process,
        mode: { kind: "staged" },
      });
      if (findings.length > 0) throw new Error(`Repository validation failed: ${findings.map(({ rule, path }) => `${rule}:${path}`).join(", ")}`);
      const templates = await chezmoi.verifyTemplates();
      if (templates.exitCode !== 0) throw new Error("Chezmoi template validation failed");
    },
    commit: async (message: string, sources: readonly string[]) => {
      await git.stage([...new Set([...changedSources, ...sources])]);
      await git.commit(message);
      return git.head();
    },
    push: () => git.push(),
    abortMerge: () => git.abortMerge(),
  };
}

export async function runSyncCommand(
  dependencies: CliDependencies,
  options: SyncCommandOptions,
  services?: SyncTransactionServices,
): Promise<number> {
  try {
    const result = await runSyncTransaction(options, services ?? await createSyncServices(dependencies));
    dependencies.logger.info(options.dryRun ? "Sync preview complete" : "Sync complete", {
      changedSources: result.changedSources,
      commit: result.commit,
      pushed: result.pushed,
    });
    for (const warning of result.warnings) dependencies.logger.warn(warning);
    return result.warnings.length === 0 ? 0 : 1;
  } catch (error) {
    dependencies.logger.error(error instanceof Error ? error.message : "Sync failed");
    return 1;
  }
}
