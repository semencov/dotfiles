import { expect, test } from "bun:test";

import { assertPublicInventory, canonicalInventory } from "../../src/inventory/filter";

test("canonical inventory is stable, unique, and versionless", () => {
  expect(canonicalInventory([
    { id: "z", kind: "formula" },
    { id: "a", kind: "formula", source: "https://formulae.brew.sh" },
    { id: "z", kind: "formula" },
  ])).toEqual([
    { id: "a", kind: "formula", source: "https://formulae.brew.sh" },
    { id: "z", kind: "formula" },
  ]);
});

test("public filtering denies private registries, file URLs, and internal namespaces", () => {
  for (const source of ["https://packages.company.internal", "file:///tmp/tool", "private/tap"]) {
    expect(() => assertPublicInventory([{ id: "tool", kind: "package", source }])).toThrow("not public");
  }
  expect(() => assertPublicInventory([{ id: "@company/tool", kind: "package" }])).toThrow("not public");
});
