import { canonicalJson } from "./json";
import { normalizeOpenLogi } from "./openlogi";
import { canonicalText } from "./text";
import { canonicalToml } from "./toml";
import type { NormalizeContext, Normalizer } from "./types";

export class UnknownSchemaError extends Error {
  public constructor(public readonly target: string, public readonly keyPath: string) {
    super(`Unknown schema key in ${target}: ${keyPath}`);
    this.name = "UnknownSchemaError";
  }
}

export class NormalizerRegistry {
  readonly #normalizers: ReadonlyMap<string, Normalizer>;

  public constructor(normalizers: readonly Normalizer[]) {
    if (new Set(normalizers.map(({ id }) => id)).size !== normalizers.length) throw new TypeError("Duplicate normalizer ID");
    this.#normalizers = new Map(normalizers.map((normalizer) => [normalizer.id, normalizer]));
  }

  public async normalize(id: string, input: Uint8Array, context: NormalizeContext): Promise<Uint8Array> {
    const normalizer = this.#normalizers.get(id);
    if (normalizer === undefined) throw new TypeError(`Unknown normalizer: ${id}`);
    return normalizer.normalize(input, context);
  }
}

export function createNormalizerRegistry(): NormalizerRegistry {
  return new NormalizerRegistry([
    { id: "json-canonical-v1", schemaVersion: 1, normalize: async (input, context) => canonicalJson(input, context) },
    { id: "openlogi-v1", schemaVersion: 1, normalize: async (input, context) => normalizeOpenLogi(input, context) },
    { id: "text-v1", schemaVersion: 1, normalize: async (input) => canonicalText(input) },
    { id: "toml-v1", schemaVersion: 1, normalize: async (input, context) => canonicalToml(input, context) },
  ]);
}
