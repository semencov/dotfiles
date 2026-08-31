import {
  access,
  chmod as nodeChmod,
  copyFile as nodeCopyFile,
  lstat as nodeLstat,
  mkdir as nodeMkdir,
  mkdtemp as nodeMkdtemp,
  open,
  readFile,
  readdir as nodeReaddir,
  realpath as nodeRealpath,
  rename as nodeRename,
  rm,
  rmdir,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type FileType = "file" | "directory" | "symlink" | "other";

export interface FileMetadata {
  readonly type: FileType;
  readonly mode: number;
  readonly size: number;
}

export interface FileSystem {
  exists(path: string): Promise<boolean>;
  lstat(path: string): Promise<FileMetadata | null>;
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  writeTextAtomic(path: string, contents: string, mode?: number): Promise<void>;
  writeBytesAtomic(path: string, contents: Uint8Array, mode?: number): Promise<void>;
  mkdir(path: string, mode?: number): Promise<void>;
  rename(source: string, destination: string): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  readdir(path: string): Promise<readonly string[]>;
  realpath(path: string): Promise<string>;
  removeEmptyDirectory(path: string): Promise<void>;
  removeTree(path: string): Promise<void>;
  mkdtemp(prefix: string): Promise<string>;
}

function fileType(stats: Awaited<ReturnType<typeof nodeLstat>>): FileType {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symlink";
  return "other";
}

export class NodeFileSystem implements FileSystem {
  public async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  public async lstat(path: string): Promise<FileMetadata | null> {
    try {
      const stats = await nodeLstat(path);
      return { type: fileType(stats), mode: stats.mode & 0o7777, size: stats.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  public async readText(path: string): Promise<string> { return readFile(path, "utf8"); }
  public async readBytes(path: string): Promise<Uint8Array> { return readFile(path); }
  public async writeTextAtomic(path: string, contents: string, mode?: number): Promise<void> {
    await this.#writeAtomic(path, contents, mode);
  }
  public async writeBytesAtomic(path: string, contents: Uint8Array, mode?: number): Promise<void> {
    await this.#writeAtomic(path, contents, mode);
  }
  public async mkdir(path: string, mode?: number): Promise<void> {
    await nodeMkdir(path, { recursive: true, ...(mode === undefined ? {} : { mode }) });
    if (mode !== undefined) await nodeChmod(path, mode);
  }
  public async rename(source: string, destination: string): Promise<void> { await nodeRename(source, destination); }
  public async copyFile(source: string, destination: string): Promise<void> { await nodeCopyFile(source, destination); }
  public async chmod(path: string, mode: number): Promise<void> { await nodeChmod(path, mode); }
  public async readdir(path: string): Promise<readonly string[]> { return nodeReaddir(path); }
  public async realpath(path: string): Promise<string> { return nodeRealpath(path); }
  public async removeEmptyDirectory(path: string): Promise<void> { await rmdir(path); }
  public async removeTree(path: string): Promise<void> { await rm(path, { recursive: true, force: true }); }
  public async mkdtemp(prefix: string): Promise<string> { return nodeMkdtemp(prefix); }

  async #writeAtomic(path: string, contents: string | Uint8Array, mode?: number): Promise<void> {
    const temporaryPath = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
    const handle = await open(temporaryPath, "wx", mode ?? 0o600);

    try {
      await handle.writeFile(contents);
      await handle.sync();
      if (mode !== undefined) await handle.chmod(mode);
      await handle.close();
      await nodeRename(temporaryPath, path);
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }
}
