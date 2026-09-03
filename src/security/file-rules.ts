import { isAbsolute, normalize, sep } from "node:path";

import type { SyncPolicyEntry } from "../policy/types";
import type { SecurityFinding } from "./secret-rules";

export function isContainedRepositoryPath(path: string): boolean {
  return path.length > 0 && !isAbsolute(path) && normalize(path) === path && path !== ".." && !path.startsWith(`..${sep}`);
}

export function validateManagedBlob(
  path: string,
  contents: string,
  entry: SyncPolicyEntry,
): readonly SecurityFinding[] {
  const bytes = new TextEncoder().encode(contents);
  const findings: SecurityFinding[] = [];
  if (bytes.length > entry.maxBytes) findings.push({ rule: "file-oversized", path });
  if (contents.includes("\0")) findings.push({ rule: "file-binary", path });
  if (entry.allowedFormats.includes("json") && !contents.includes("\0")) {
    try {
      JSON.parse(contents);
    } catch {
      findings.push({ rule: "format-invalid-json", path });
    }
  }
  return findings;
}
