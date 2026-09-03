import type { OperatingSystem } from "../lib/platform";

export type ManagedClassification = "managed" | "inventory" | "generated";
export type ManagedFormat = "text" | "json" | "toml" | "yaml";

export interface SyncPolicyEntry {
  readonly id: string;
  readonly target: string;
  readonly source: string;
  readonly platform: readonly OperatingSystem[];
  readonly classification: ManagedClassification;
  readonly normalizer?: string;
  readonly maxBytes: number;
  readonly allowedFormats: readonly ManagedFormat[];
}

export interface SyncPolicy {
  readonly version: 1;
  readonly repositoryPaths: readonly string[];
  readonly entries: readonly SyncPolicyEntry[];
}
