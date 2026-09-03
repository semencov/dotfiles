import type { NormalizeContext } from "./types";
import { decodeUtf8 } from "./text";
import { UnknownSchemaError } from "./registry";

const VOLATILE_KEYS = new Set(["cache", "lastUpdated", "machineId", "recentPaths", "timestamp", "updatedAt"]);
const SOURCE_KEYS = /registry|source|url/i;

function canonicalize(value: unknown, context: NormalizeContext, path: string): unknown {
  if (Array.isArray(value)) return value.map((entry, index) => canonicalize(entry, context, `${path}[${index}]`));
  if (typeof value !== "object" || value === null) return value;

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (VOLATILE_KEYS.has(key)) continue;
    const child = (value as Record<string, unknown>)[key];
    const childPath = path.length === 0 ? key : `${path}.${key}`;
    if (SOURCE_KEYS.test(key) && typeof child === "string" && /^https?:\/\//.test(child)) {
      const origin = new URL(child).origin;
      if (!context.publicSourceAllowlist.has(child) && !context.publicSourceAllowlist.has(origin)) {
        throw new UnknownSchemaError(context.target, childPath);
      }
    }
    result[key] = canonicalize(child, context, childPath);
  }
  return result;
}

export function canonicalJson(input: Uint8Array, context: NormalizeContext): Uint8Array {
  const parsed: unknown = JSON.parse(decodeUtf8(input));
  return new TextEncoder().encode(`${JSON.stringify(canonicalize(parsed, context, ""), null, 2)}\n`);
}
