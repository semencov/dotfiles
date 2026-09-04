export type CommandPlatform = "macos" | "ubuntu" | "debian";

export interface CommandDefinition {
  readonly name: string;
  readonly summary: string;
  readonly platforms: readonly CommandPlatform[];
  readonly externalTools: readonly string[];
}

export interface CommandCatalogData {
  readonly version: 1;
  readonly commands: readonly CommandDefinition[];
  readonly deleted: Readonly<Record<string, string>>;
}

export interface BinMigrationAudit {
  readonly pending: readonly string[];
  readonly unclassified: readonly string[];
}
