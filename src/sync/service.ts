import type { MergeStartResult } from "../git/types";
import type { LiveSnapshot, SyncOptions, SyncResult } from "./types";

export interface SyncTransactionServices {
  assertPreconditions(): Promise<void>;
  capture(): Promise<LiveSnapshot>;
  fetch(): Promise<void>;
  merge(): Promise<MergeStartResult>;
  resolveRegisteredConflicts(): Promise<void>;
  applySnapshot(snapshot: LiveSnapshot, dryRun: boolean): Promise<readonly string[]>;
  validate(): Promise<void>;
  commit(message: string): Promise<string>;
  push(): Promise<void>;
  abortMerge(): Promise<void>;
}

export async function runSyncTransaction(
  options: SyncOptions,
  services: SyncTransactionServices,
): Promise<SyncResult> {
  await services.assertPreconditions();
  const snapshot = await services.capture();
  let merge: MergeStartResult = "unchanged";
  try {
    await services.fetch();
    if (options.dryRun) {
      const changedSources = await services.applySnapshot(snapshot, true);
      return { changedSources, commit: null, pushed: false, warnings: [] };
    }

    merge = await services.merge();
    await services.resolveRegisteredConflicts();
    const changedSources = await services.applySnapshot(snapshot, false);
    await services.validate();
    const commit = merge === "unchanged" && changedSources.length === 0
      ? null
      : await services.commit(options.message);
    if (!options.push || commit === null) return { changedSources, commit, pushed: false, warnings: [] };

    try {
      await services.push();
      return { changedSources, commit, pushed: true, warnings: [] };
    } catch {
      return {
        changedSources,
        commit,
        pushed: false,
        warnings: [`Push failed; local commit ${commit} was preserved`],
      };
    }
  } catch (error) {
    if (merge !== "unchanged") await services.abortMerge().catch(() => undefined);
    throw error;
  } finally {
    await snapshot.cleanup();
  }
}
