import { readFile } from "node:fs/promises";
import { isAbsolute, normalize, sep } from "node:path";

import type { OperatingSystem } from "../lib/platform";
import type { ManagedClassification, ManagedFormat, SyncPolicy, SyncPolicyEntry } from "./types";

const OPERATING_SYSTEMS = ["macos", "ubuntu", "debian"] as const;
const CLASSIFICATIONS = ["managed", "inventory", "generated"] as const;
const FORMATS = ["text", "json", "toml", "yaml"] as const;
const NORMALIZERS = new Set(["json-canonical-v1", "openlogi-v1", "text-v1", "toml-v1"]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const allowed = [...keys].sort();
  if (actual.some((key) => !allowed.includes(key))) throw new TypeError(`${label} contains unknown keys`);
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function relativePath(value: unknown, label: string): string {
  const path = string(value, label);
  if (isAbsolute(path) || normalize(path) !== path || path === ".." || path.startsWith(`..${sep}`)) {
    throw new TypeError(`${label} must be a contained relative path`);
  }
  return path;
}

function uniqueCanonical<T extends string>(value: unknown, allowed: readonly T[], label: string): readonly T[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || !allowed.includes(entry as T))) {
    throw new TypeError(`${label} is invalid`);
  }
  const canonical = allowed.filter((entry) => value.includes(entry));
  if (new Set(value).size !== value.length || JSON.stringify(value) !== JSON.stringify(canonical)) {
    throw new TypeError(`${label} must be unique and canonical`);
  }
  return canonical;
}

function parseEntry(value: unknown): SyncPolicyEntry {
  const input = object(value, "policy entry");
  exactKeys(input, ["id", "target", "source", "platform", "classification", "normalizer", "maxBytes", "allowedFormats"], "policy entry");
  const id = string(input.id, "entry id");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new TypeError(`Invalid entry id: ${id}`);
  const classification = string(input.classification, "classification") as ManagedClassification;
  if (!(CLASSIFICATIONS as readonly string[]).includes(classification)) throw new TypeError(`Invalid classification: ${classification}`);
  if (!Number.isSafeInteger(input.maxBytes) || (input.maxBytes as number) <= 0) throw new TypeError("maxBytes must be a positive integer");
  const normalizer = input.normalizer === undefined ? undefined : string(input.normalizer, "normalizer");
  if (normalizer !== undefined && !NORMALIZERS.has(normalizer)) throw new TypeError(`Unknown normalizer: ${normalizer}`);
  return {
    id,
    target: relativePath(input.target, "target"),
    source: relativePath(input.source, "source"),
    platform: uniqueCanonical(input.platform, OPERATING_SYSTEMS, "platform"),
    classification,
    ...(normalizer === undefined ? {} : { normalizer }),
    maxBytes: input.maxBytes as number,
    allowedFormats: uniqueCanonical(input.allowedFormats, FORMATS, "allowedFormats"),
  };
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(`Duplicate ${label}`);
}

export class PolicyRegistry {
  public readonly version = 1 as const;
  public readonly repositoryPaths: readonly string[];
  public readonly entries: readonly SyncPolicyEntry[];

  private constructor(policy: SyncPolicy) {
    this.repositoryPaths = policy.repositoryPaths;
    this.entries = policy.entries;
  }

  public static async load(path: string): Promise<PolicyRegistry> {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    const input = object(parsed, "sync policy");
    exactKeys(input, ["version", "repositoryPaths", "entries"], "sync policy");
    if (input.version !== 1) throw new TypeError("sync policy version must be 1");
    if (!Array.isArray(input.repositoryPaths) || input.repositoryPaths.length === 0) throw new TypeError("repositoryPaths must be non-empty");
    const repositoryPaths = input.repositoryPaths.map((value) => relativePath(value, "repository path"));
    assertUnique(repositoryPaths, "repository path");
    if (JSON.stringify(repositoryPaths) !== JSON.stringify([...repositoryPaths].sort())) {
      throw new TypeError("repositoryPaths must be sorted");
    }
    if (!Array.isArray(input.entries)) throw new TypeError("entries must be an array");
    const entries = input.entries.map(parseEntry);
    if (JSON.stringify(entries.map(({ id }) => id)) !== JSON.stringify(entries.map(({ id }) => id).sort())) {
      throw new TypeError("entries must be sorted by id");
    }
    assertUnique(entries.map(({ id }) => id), "entry id");
    assertUnique(entries.map(({ target }) => target), "target");
    assertUnique(entries.map(({ source }) => source), "source");
    for (const { source } of entries) {
      const contained = repositoryPaths.some((root) => source === root || source.startsWith(`${root}/`));
      if (!contained) throw new TypeError(`Source is outside repository policy roots: ${source}`);
    }
    return new PolicyRegistry({ version: 1, repositoryPaths, entries });
  }

  public forPlatform(platform: OperatingSystem): readonly SyncPolicyEntry[] {
    return this.entries.filter(({ platform: supported }) => supported.includes(platform));
  }

  public getByTarget(target: string): SyncPolicyEntry | undefined {
    return this.entries.find((entry) => entry.target === target);
  }
}
