import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import type { FileSystem } from "../lib/filesystem";
import type {
  BackupArchive,
  BackupCandidate,
  BackupEntry,
  BackupEntryType,
  BackupManifest,
  RenderedTarget,
} from "./types";

export interface BackupServiceOptions {
  readonly fs: FileSystem;
  readonly homeDir: string;
  readonly backupRoot: string;
  readonly now?: () => Date;
}

function isContained(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function lexicalRelativePath(homeDir: string, target: string): string {
  const normalizedHome = resolve(homeDir);
  const normalizedTarget = resolve(target);
  const child = relative(normalizedHome, normalizedTarget);
  if (child === "" || child === ".." || child.startsWith("../") || isAbsolute(child)) {
    throw new Error(`Backup source is outside HOME: ${target}`);
  }
  return child;
}

async function assertRealContainment(
  fs: FileSystem,
  homeDir: string,
  target: string,
  type: BackupEntryType,
): Promise<void> {
  const realHome = await fs.realpath(homeDir);
  const realParent = await fs.realpath(dirname(target));
  if (!isContained(realHome, realParent) && realParent !== realHome) {
    throw new Error(`Backup source parent resolves outside HOME: ${target}`);
  }
  if (type !== "symlink") {
    const realTarget = await fs.realpath(target);
    if (!isContained(realHome, realTarget)) {
      throw new Error(`Backup source resolves outside HOME: ${target}`);
    }
  }
}

function supportedType(type: string, target: string): BackupEntryType {
  if (type === "file" || type === "directory" || type === "symlink") return type;
  throw new Error(`Unsupported backup source type at ${target}: ${type}`);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

export async function discoverChezmoiConflicts(
  targets: readonly RenderedTarget[],
  fs: FileSystem,
  homeDir: string,
): Promise<readonly BackupCandidate[]> {
  const conflicts: BackupCandidate[] = [];

  for (const target of targets) {
    const relativePath = lexicalRelativePath(homeDir, target.target);
    const metadata = await fs.lstat(target.target);
    if (metadata === null) continue;
    const type = supportedType(metadata.type, target.target);
    await assertRealContainment(fs, homeDir, target.target, type);

    const isIdenticalDirectory = target.type === "directory" && type === "directory";
    const isIdenticalFile = target.type === "file"
      && type === "file"
      && sameBytes(await fs.readBytes(target.target), target.contents);
    if (isIdenticalDirectory || isIdenticalFile) continue;

    conflicts.push({
      source: target.target,
      relativePath,
      type,
      mode: metadata.mode,
      reason: target.reason ?? (type === "symlink" ? "legacy-symlink" : "chezmoi-conflict"),
    });
  }

  return conflicts;
}

function archiveId(date: Date): string {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

export class BackupService {
  readonly #fs: FileSystem;
  readonly #homeDir: string;
  readonly #backupRoot: string;
  readonly #now: () => Date;

  public constructor(options: BackupServiceOptions) {
    this.#fs = options.fs;
    this.#homeDir = resolve(options.homeDir);
    this.#backupRoot = resolve(options.backupRoot);
    this.#now = options.now ?? (() => new Date());
    if (!isContained(this.#homeDir, this.#backupRoot)) {
      throw new Error("Backup root must be inside HOME");
    }
  }

  public async archive(candidates: readonly BackupCandidate[]): Promise<BackupArchive | null> {
    if (candidates.length === 0) return null;

    const createdAt = this.#now();
    const id = archiveId(createdAt);
    const path = resolve(this.#backupRoot, id);
    await this.#fs.mkdir(this.#backupRoot, 0o700);
    if (await this.#fs.exists(path)) throw new Error(`Backup archive already exists: ${id}`);
    await this.#fs.mkdir(path, 0o700);
    const entries: BackupEntry[] = [];

    for (const candidate of candidates) {
      const relativePath = lexicalRelativePath(this.#homeDir, candidate.source);
      if (relativePath !== candidate.relativePath) throw new Error(`Backup relative path mismatch: ${candidate.source}`);
      if (isContained(this.#backupRoot, resolve(candidate.source)) || resolve(candidate.source) === this.#backupRoot) {
        throw new Error(`Cannot archive the backup store itself: ${candidate.source}`);
      }
      await assertRealContainment(this.#fs, this.#homeDir, candidate.source, candidate.type);
      const backupPath = resolve(path, relativePath);
      await this.#fs.mkdir(dirname(backupPath), 0o700);
      await this.#fs.rename(candidate.source, backupPath);
      entries.push({ ...candidate, relativePath, backupPath });
      await this.#writeManifest(path, createdAt, entries);
    }

    return {
      id,
      path,
      manifest: { version: 1, createdAt: createdAt.toISOString(), homeDir: this.#homeDir, entries },
    };
  }

  async #writeManifest(path: string, createdAt: Date, entries: readonly BackupEntry[]): Promise<void> {
    const manifest: BackupManifest = {
      version: 1,
      createdAt: createdAt.toISOString(),
      homeDir: this.#homeDir,
      entries,
    };
    await this.#fs.writeTextAtomic(`${path}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
  }
}
