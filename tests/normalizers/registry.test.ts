import { describe, expect, test } from "bun:test";

import { createNormalizerRegistry, UnknownSchemaError } from "../../src/normalizers/registry";

const context = {
  target: ".example.json",
  platform: "macos" as const,
  publicSourceAllowlist: new Set(["https://registry.npmjs.org"]),
};

describe("NormalizerRegistry", () => {
  test("canonicalizes JSON recursively and is idempotent", async () => {
    const registry = createNormalizerRegistry();
    const input = new TextEncoder().encode('{"z":1,"nested":{"b":2,"a":1},"a":2}');
    const once = await registry.normalize("json-canonical-v1", input, context);
    const twice = await registry.normalize("json-canonical-v1", once, context);

    expect(new TextDecoder().decode(once)).toBe('{\n  "a": 2,\n  "nested": {\n    "a": 1,\n    "b": 2\n  },\n  "z": 1\n}\n');
    expect(twice).toEqual(once);
  });

  test("normalizes text line endings and one final newline", async () => {
    const registry = createNormalizerRegistry();
    const output = await registry.normalize("text-v1", new TextEncoder().encode("one\r\ntwo\r\n\r\n"), context);
    expect(new TextDecoder().decode(output)).toBe("one\ntwo\n");
  });

  test("rejects malformed input and unknown normalizers", async () => {
    const registry = createNormalizerRegistry();
    await expect(registry.normalize("json-canonical-v1", new TextEncoder().encode("{"), context)).rejects.toThrow();
    await expect(registry.normalize("missing-v1", new Uint8Array(), context)).rejects.toThrow("Unknown normalizer");
  });

  test("rejects private package sources and unknown schema keys", async () => {
    const registry = createNormalizerRegistry();
    await expect(registry.normalize("json-canonical-v1", new TextEncoder().encode(JSON.stringify({
      registry: "https://packages.company.internal",
    })), context)).rejects.toBeInstanceOf(UnknownSchemaError);
    await expect(registry.normalize("toml-v1", new TextEncoder().encode("unknown = true\n"), {
      ...context,
      target: ".starship.toml",
    })).rejects.toThrow("unknown");
  });
});
