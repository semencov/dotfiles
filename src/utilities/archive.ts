import { $ } from "bun";
import { basename, resolve } from "node:path";

import { childExit, requireTools, UtilityUsageError } from "./runtime";

export type ArchiveKind = "tar.bz2" | "tar.gz" | "bz2" | "rar" | "gz" | "tar" | "zip" | "7z" | "xz";
export type PackKind = "tbz" | "tgz" | "txz" | "tar" | "bz2" | "gz" | "zip" | "7z";

export function archiveKind(path: string): ArchiveKind {
  const lower = path.toLowerCase();
  if (/\.(?:tar\.bz2|tbz2|tbz)$/.test(lower)) return "tar.bz2";
  if (/\.(?:tar\.gz|tgz)$/.test(lower)) return "tar.gz";
  if (lower.endsWith(".bz2")) return "bz2";
  if (lower.endsWith(".rar")) return "rar";
  if (lower.endsWith(".gz")) return "gz";
  if (lower.endsWith(".tar")) return "tar";
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".7z")) return "7z";
  if (lower.endsWith(".xz")) return "xz";
  throw new UtilityUsageError(`Unsupported archive: ${path}`);
}

async function checked(command: string, operation: Promise<{ exitCode: number }>): Promise<void> {
  const result = await operation;
  if (result.exitCode !== 0) childExit(command, result.exitCode);
}

export async function extractArchive(path: string): Promise<void> {
  const kind = archiveKind(path);
  const file = Bun.file(path);
  if (!await file.exists()) throw new UtilityUsageError(`Not a file: ${path}`);
  switch (kind) {
    case "tar.bz2":
      await requireTools(["tar"]);
      return checked("tar", $`tar xjf ${path}`.nothrow());
    case "tar.gz":
      await requireTools(["tar"]);
      return checked("tar", $`tar xzf ${path}`.nothrow());
    case "bz2":
      await requireTools(["bunzip2"]);
      return checked("bunzip2", $`bunzip2 ${path}`.nothrow());
    case "rar":
      await requireTools(["unrar"]);
      return checked("unrar", $`unrar x ${path}`.nothrow());
    case "gz":
      await requireTools(["gunzip"]);
      return checked("gunzip", $`gunzip ${path}`.nothrow());
    case "tar":
      await requireTools(["tar"]);
      return checked("tar", $`tar xf ${path}`.nothrow());
    case "zip":
      await requireTools(["unzip"]);
      return checked("unzip", $`unzip ${path}`.nothrow());
    case "7z":
      await requireTools(["7z"]);
      return checked("7z", $`7z x ${path}`.nothrow());
    case "xz":
      await requireTools(["xz"]);
      return checked("xz", $`xz -dk ${path}`.nothrow());
  }
}

export async function packArchive(kind: PackKind, input = process.cwd()): Promise<string> {
  const target = resolve(input);
  const name = basename(target);
  const output = resolve(process.cwd(), `${name}.${kind === "tbz" ? "tar.bz2" : kind === "tgz" ? "tar.gz" : kind === "txz" ? "tar.xz" : kind}`);
  switch (kind) {
    case "tbz":
      await requireTools(["tar"]);
      await checked("tar", $`tar cjf ${output} ${target}`.nothrow());
      break;
    case "tgz":
      await requireTools(["tar"]);
      await checked("tar", $`tar czf ${output} ${target}`.nothrow());
      break;
    case "txz":
      await requireTools(["tar"]);
      await checked("tar", $`tar cJf ${output} ${target}`.nothrow());
      break;
    case "tar":
      await requireTools(["tar"]);
      await checked("tar", $`tar cf ${output} ${target}`.nothrow());
      break;
    case "bz2":
      await requireTools(["bzip2"]);
      await checked("bzip2", $`bzip2 -k ${target}`.nothrow());
      return `${target}.bz2`;
    case "gz":
      await requireTools(["gzip"]);
      await checked("gzip", $`gzip -c -9 -n ${target} > ${output}`.nothrow());
      break;
    case "zip":
      await requireTools(["zip"]);
      await checked("zip", $`zip -r ${output} ${target}`.nothrow());
      break;
    case "7z":
      await requireTools(["7z"]);
      await checked("7z", $`7z a ${output} ${target}`.nothrow());
      break;
    default:
      kind satisfies never;
  }
  return output;
}
