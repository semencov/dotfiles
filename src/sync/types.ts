import type { SyncPolicyEntry } from "../policy/types";

export interface SyncOptions {
  readonly push: boolean;
  readonly dryRun: boolean;
  readonly message: string;
}

export interface SyncResult {
  readonly changedSources: readonly string[];
  readonly commit: string | null;
  readonly pushed: boolean;
  readonly warnings: readonly string[];
}

export interface LiveSnapshotEntry {
  readonly policy: SyncPolicyEntry;
  readonly contents: Uint8Array;
  readonly hash: string;
  readonly mode: number;
}

export interface LiveSnapshot {
  readonly path: string;
  readonly entries: readonly LiveSnapshotEntry[];
  cleanup(): Promise<void>;
}
