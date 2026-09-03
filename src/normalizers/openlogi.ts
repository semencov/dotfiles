import { UnknownSchemaError } from "./registry";
import { decodeUtf8 } from "./text";
import { serializeToml } from "./toml";
import type { NormalizeContext } from "./types";

const ROOT_KEYS = new Set(["active_profile", "bindings", "device_id", "profiles", "ui", "version"]);
const UI_KEYS = new Set(["locale", "show_overlay"]);
const BINDING_KEYS = new Set(["action", "button"]);
const PROFILE_KEYS = new Set(["id", "name"]);

function record(value: unknown, context: NormalizeContext, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new UnknownSchemaError(context.target, path);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>, context: NormalizeContext, path: string): void {
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) throw new UnknownSchemaError(context.target, path.length === 0 ? key : `${path}.${key}`);
  }
}

export function normalizeOpenLogi(input: Uint8Array, context: NormalizeContext): Uint8Array {
  const toml = Bun.TOML;
  if (toml === undefined) throw new Error("Bun TOML support is unavailable");
  const parsed = record(toml.parse(decodeUtf8(input)), context, "root");
  exactKeys(parsed, ROOT_KEYS, context, "");
  if (parsed.version !== 1 || typeof parsed.device_id !== "string" || typeof parsed.active_profile !== "string") {
    throw new UnknownSchemaError(context.target, "identity");
  }
  const ui = record(parsed.ui, context, "ui");
  exactKeys(ui, UI_KEYS, context, "ui");
  if (!Array.isArray(parsed.bindings) || !Array.isArray(parsed.profiles)) throw new UnknownSchemaError(context.target, "collections");
  for (const [index, binding] of parsed.bindings.entries()) {
    exactKeys(record(binding, context, `bindings[${index}]`), BINDING_KEYS, context, `bindings[${index}]`);
  }
  for (const [index, profile] of parsed.profiles.entries()) {
    exactKeys(record(profile, context, `profiles[${index}]`), PROFILE_KEYS, context, `profiles[${index}]`);
  }
  return serializeToml(parsed);
}
