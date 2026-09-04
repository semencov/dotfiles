import { chmod, lstat, readdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { UtilityOperationalError, UtilityUsageError } from "./runtime";

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["kB", "MB", "GB"];
  let value = bytes;
  let unit = "B";
  for (const next of units) {
    value /= 1000;
    unit = next;
    if (value < 1000) break;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${unit}`;
}

export function assertSafePermissionRoot(path: string, repository: string): string {
  const root = resolve(path);
  const blocked = new Set([resolve("/"), resolve(homedir()), resolve(repository)]);
  if (blocked.has(root)) throw new UtilityUsageError(`Refusing broad permission target: ${root}`);
  return root;
}

export async function resetPermissions(root: string): Promise<void> {
  async function visit(path: string): Promise<void> {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) return;
    if (metadata.isDirectory()) {
      if (path !== root) await chmod(path, 0o755);
      for (const entry of await readdir(path)) await visit(join(path, entry));
    } else if (metadata.isFile()) {
      await chmod(path, 0o644);
    }
  }
  await visit(root);
}

export async function regularFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];
  async function visit(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) files.push(child);
    }
  }
  await visit(root);
  return files.sort();
}

export interface RenameOperation {
  readonly from: string;
  readonly to: string;
}

export async function renamePlan(root: string, search: string, replacement: string): Promise<readonly RenameOperation[]> {
  if (search.length === 0) throw new UtilityUsageError("Rename search must not be empty");
  const result: RenameOperation[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.name.startsWith(search)) continue;
    result.push({ from: join(root, entry.name), to: join(root, entry.name.replace(search, replacement)) });
  }
  return result;
}

export async function applyRenamePlan(operations: readonly RenameOperation[]): Promise<void> {
  for (const operation of operations) {
    if (await Bun.file(operation.to).exists()) throw new UtilityOperationalError(`Target already exists: ${operation.to}`);
    await rename(operation.from, operation.to);
  }
}

export function displayPath(path: string, root = process.cwd()): string {
  const value = relative(root, path);
  return value.startsWith("..") ? path : value || ".";
}

export async function atomicReplace(path: string, contents: Uint8Array, mode = 0o600): Promise<void> {
  const temporary = join(dirname(path), `.${Date.now()}-${crypto.randomUUID()}.tmp`);
  await Bun.write(temporary, contents);
  await chmod(temporary, mode);
  await rename(temporary, path);
}
