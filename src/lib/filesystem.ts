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
