export type BackupReason =
  | "chezmoi-conflict"
  | "legacy-symlink"
  | "repository-conflict"
  | "chezmoi-config-migration";

export type BackupEntryType = "file" | "directory" | "symlink";

export interface BackupEntry {
  readonly source: string;
  readonly relativePath: string;
  readonly backupPath: string;
  readonly type: BackupEntryType;
  readonly mode: number;
  readonly reason: BackupReason;
}

export interface BackupManifest {
  readonly version: 1;
  readonly createdAt: string;
  readonly homeDir: string;
  readonly entries: readonly BackupEntry[];
}

export interface BackupArchive {
  readonly id: string;
  readonly path: string;
  readonly manifest: BackupManifest;
}

export interface BackupCandidate {
  readonly source: string;
  readonly relativePath: string;
  readonly type: BackupEntryType;
  readonly mode: number;
  readonly reason: BackupReason;
}

export type RenderedTarget =
  | {
    readonly target: string;
    readonly type: "file";
    readonly contents: Uint8Array;
    readonly reason?: BackupReason;
  }
  | {
    readonly target: string;
    readonly type: "directory";
    readonly reason?: BackupReason;
  }
  | {
    readonly target: string;
    readonly type: "absent";
    readonly reason?: BackupReason;
  };
