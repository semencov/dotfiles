import { readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import { UtilityOperationalError } from "./runtime";

function expandHome(path: string): string {
  return path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : resolve(path);
}

export async function projectRootsFromLocalConfig(): Promise<readonly string[]> {
  const configPath = join(homedir(), ".config", "dotfiles", "local.json");
  if (!await Bun.file(configPath).exists()) return [join(homedir(), "Projects")];
  const value: unknown = JSON.parse(await Bun.file(configPath).text());
  if (typeof value !== "object" || value === null || !("projectPaths" in value) || !Array.isArray(value.projectPaths)) {
    return [join(homedir(), "Projects")];
  }
  const roots = value.projectPaths.filter((path): path is string => typeof path === "string").map(expandHome);
  return roots.length > 0 ? roots : [join(homedir(), "Projects")];
}

export async function findProject(projectRoots: readonly string[], query: string): Promise<string> {
  const normalized = query.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (normalized.length === 0) throw new UtilityOperationalError("Project query is empty");
  const pattern = [...normalized].join(".*");
  const matcher = new RegExp(pattern, "i");
  const matches: string[] = [];
  for (const root of projectRoots) {
    try {
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (entry.isDirectory() && matcher.test(entry.name.replace(/[^a-z0-9]/gi, ""))) matches.push(join(root, entry.name));
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  matches.sort((left, right) => basename(left).length - basename(right).length || left.localeCompare(right));
  if (matches[0] === undefined) throw new UtilityOperationalError("Project not found");
  return matches[0];
}

const generatedDirectories = new Set([
  "node_modules", ".cache", ".idea", "vendor", ".Spotlight-V100", ".Trashes", ".fseventsd", ".TemporaryItems",
]);

export async function generatedProjectArtifacts(root: string): Promise<readonly string[]> {
  const found: string[] = [];
  async function visit(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        if (generatedDirectories.has(entry.name)) found.push(child);
        else await visit(child);
      } else if (entry.isFile() && (
        entry.name === ".DS_Store" || entry.name === "Thumbs.db" || entry.name.startsWith("._") || entry.name.endsWith(".log")
      )) found.push(child);
    }
  }
  await visit(resolve(root));
  return found.sort();
}

export async function removeProjectArtifacts(paths: readonly string[]): Promise<void> {
  for (const path of paths) await rm(path, { recursive: true, force: true });
}
