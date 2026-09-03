import type { NormalizeContext } from "./types";
import { decodeUtf8 } from "./text";
import { UnknownSchemaError } from "./registry";

const STARSHIP_KEYS = new Set([
  "add_newline", "battery", "character", "command_timeout", "custom", "directory", "format", "git_branch",
  "git_commit", "git_metrics", "git_state", "git_status", "hostname", "line_break", "nodejs", "os", "package",
  "right_format", "scan_timeout", "shell", "username",
]);

export function sortedObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedObject((value as Record<string, unknown>)[key])]));
}

export function serializeToml(value: unknown): Uint8Array {
  const toml = Bun.TOML;
  if (toml === undefined) throw new Error("Bun TOML support is unavailable");
  const output = toml.stringify(sortedObject(value));
  if (output === undefined) throw new Error("Bun could not serialize TOML");
  const rendered = output.trimEnd();
  return new TextEncoder().encode(`${rendered}\n`);
}

export function canonicalToml(input: Uint8Array, context: NormalizeContext): Uint8Array {
  const toml = Bun.TOML;
  if (toml === undefined) throw new Error("Bun TOML support is unavailable");
  const parsed = toml.parse(decodeUtf8(input)) as Record<string, unknown>;
  if (context.target === ".starship.toml") {
    for (const key of Object.keys(parsed)) {
      if (!STARSHIP_KEYS.has(key)) throw new UnknownSchemaError(context.target, key);
    }
  }
  return serializeToml(parsed);
}
