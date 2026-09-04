import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type {
  BinMigrationAudit,
  CommandCatalogData,
  CommandDefinition,
  CommandPlatform,
} from "./types";

const platforms = new Set<CommandPlatform>(["macos", "ubuntu", "debian"]);
const commandKeys = ["externalTools", "name", "platforms", "summary"] as const;
const rootKeys = ["commands", "deleted", "version"] as const;
const legacyPatterns = [
  "#!/bin/bash",
  "#!/usr/bin/env bash",
  "#!/usr/bin/env zsh",
  "#!/usr/bin/env node",
  "#!/usr/bin/env zx",
  "bash -c",
  "sh -c",
  "eval(",
  "{ raw:",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) {
    throw new Error(`${label} has an unknown or missing key`);
  }
}

function uniqueStrings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} contains a duplicate external tool or value`);
  return value;
}

function parseCommand(value: unknown): CommandDefinition {
  if (!isRecord(value)) throw new Error("command must be an object");
  exactKeys(value, commandKeys, "command");
  if (typeof value.name !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(value.name) || value.name.includes(".")) {
    throw new Error("command name must be extensionless and contain no path separators");
  }
  if (typeof value.summary !== "string" || value.summary.trim() !== value.summary || value.summary.length === 0) {
    throw new Error(`command ${value.name} must have a non-empty canonical summary`);
  }
  const parsedPlatforms = uniqueStrings(value.platforms, `command ${value.name} platform`);
  if (parsedPlatforms.length === 0 || parsedPlatforms.some((platform) => !platforms.has(platform as CommandPlatform))) {
    throw new Error(`command ${value.name} has an unsupported platform`);
  }
  const externalTools = uniqueStrings(value.externalTools, `command ${value.name} external tools`);
  if ([...externalTools].sort().some((tool, index) => tool !== externalTools[index])) {
    throw new Error(`command ${value.name} external tools must be sorted`);
  }
  return {
    name: value.name,
    summary: value.summary,
    platforms: parsedPlatforms as readonly CommandPlatform[],
    externalTools,
  };
}

function parseCatalog(value: unknown): CommandCatalogData {
  if (!isRecord(value)) throw new Error("command catalog must be an object");
  exactKeys(value, rootKeys, "command catalog");
  if (value.version !== 1) throw new Error("command catalog version must be 1");
  if (!Array.isArray(value.commands)) throw new Error("commands must be an array");
  const commands = value.commands.map(parseCommand);
  const names = commands.map(({ name }) => name);
  if (new Set(names).size !== names.length) throw new Error("command catalog contains a duplicate command");
  if ([...names].sort().some((name, index) => name !== names[index])) {
    throw new Error("command catalog commands must be sorted");
  }
  if (!isRecord(value.deleted) || Object.values(value.deleted).some((reason) => typeof reason !== "string" || reason.length === 0)) {
    throw new Error("deleted migration outcomes must be non-empty strings");
  }
  return { version: 1, commands, deleted: value.deleted as Readonly<Record<string, string>> };
}

function logicalCommandName(file: string): string {
  if (file === "chromedriver.sh") return "chromedriver";
  if (file === "git-stats.sh") return "git-stats";
  if (file === "domains.mjs") return "domains";
  if (file === "passphrase.mjs") return "passphrase";
  return file;
}

export class CommandCatalog {
  readonly commands: readonly CommandDefinition[];
  readonly deleted: Readonly<Record<string, string>>;

  private constructor(data: CommandCatalogData) {
    this.commands = data.commands;
    this.deleted = data.deleted;
  }

  static async load(path: string): Promise<CommandCatalog> {
    const contents = await Bun.file(path).text();
    return new CommandCatalog(parseCatalog(JSON.parse(contents) as unknown));
  }

  get(name: string): CommandDefinition | undefined {
    return this.commands.find((command) => command.name === name);
  }
}

export async function auditBinMigration(repository: string): Promise<BinMigrationAudit> {
  const catalog = await CommandCatalog.load(join(repository, "config", "commands.json"));
  const retained = new Set(catalog.commands.map(({ name }) => name));
  const deleted = new Set(Object.keys(catalog.deleted));
  const pending: string[] = [];
  const unclassified: string[] = [];
  for (const entry of await readdir(join(repository, "bin"), { withFileTypes: true })) {
    if (!entry.isFile()) {
      unclassified.push(entry.name);
      continue;
    }
    const logicalName = logicalCommandName(entry.name);
    if (!retained.has(logicalName) && !deleted.has(entry.name)) {
      unclassified.push(entry.name);
      continue;
    }
    const path = join(repository, "bin", entry.name);
    const contents = await Bun.file(path).text();
    const mode = (await stat(path)).mode;
    if (
      entry.name !== logicalName
      || !contents.startsWith("#!/usr/bin/env bun\n")
      || (mode & 0o111) === 0
      || legacyPatterns.some((pattern) => contents.includes(pattern))
      || deleted.has(entry.name)
    ) pending.push(entry.name);
  }
  return { pending: pending.sort(), unclassified: unclassified.sort() };
}

export async function assertMigratedBinContract(repository: string): Promise<void> {
  const audit = await auditBinMigration(repository);
  if (audit.unclassified.length > 0 || audit.pending.length > 0) {
    throw new Error(`bin contract failed: ${[...audit.unclassified, ...audit.pending].join(", ")}`);
  }
  const catalog = await CommandCatalog.load(join(repository, "config", "commands.json"));
  const actual = (await readdir(join(repository, "bin"), { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map(({ name }) => name)
    .sort();
  const expected = catalog.commands.map(({ name }) => name);
  if (actual.some((name, index) => name !== expected[index]) || actual.length !== expected.length) {
    throw new Error(`bin/catalog mismatch: ${actual.join(", ")}`);
  }
}
