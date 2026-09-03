import { expect, test } from "bun:test";

import { createNormalizerRegistry } from "../../src/normalizers/registry";

const context = {
  target: "Library/Application Support/OpenLogi/config.toml",
  platform: "macos" as const,
  publicSourceAllowlist: new Set<string>(),
};

const completeConfig = `
version = 1
device_id = "synthetic-device"
active_profile = "default"

[ui]
show_overlay = true
locale = "en"

[[bindings]]
button = "gesture"
action = "mission-control"

[[profiles]]
id = "default"
name = "Default"
`;

test("openlogi preserves the complete approved config and is idempotent", async () => {
  const registry = createNormalizerRegistry();
  const once = await registry.normalize("openlogi-v1", new TextEncoder().encode(completeConfig), context);
  const twice = await registry.normalize("openlogi-v1", once, context);
  const parsed = Bun.TOML!.parse(new TextDecoder().decode(once)) as Record<string, unknown>;

  expect(parsed.device_id).toBe("synthetic-device");
  expect(parsed.bindings).toEqual([{ action: "mission-control", button: "gesture" }]);
  expect(parsed.profiles).toEqual([{ id: "default", name: "Default" }]);
  expect(twice).toEqual(once);
});

test("openlogi rejects unknown keys and malformed TOML", async () => {
  const registry = createNormalizerRegistry();
  await expect(registry.normalize("openlogi-v1", new TextEncoder().encode(`${completeConfig}\nsecret = true\n`), context))
    .rejects.toThrow("secret");
  await expect(registry.normalize("openlogi-v1", new TextEncoder().encode("["), context)).rejects.toThrow();
});
