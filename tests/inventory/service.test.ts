import { expect, test } from "bun:test";

import { snapshotInventories } from "../../src/inventory/service";
import type { InventoryProvider } from "../../src/inventory/types";
import { createFakeDependencies } from "../support/fakes";

test("snapshotInventories reports only content changes", async () => {
  const path = "/Users/test/.dotfiles/inventories/example.json";
  const contents = `${JSON.stringify({
    version: 1,
    provider: "example",
    items: [{ id: "tool", kind: "package" }],
  }, null, 2)}\n`;
  const dependencies = createFakeDependencies({}, { [path]: contents });
  const provider: InventoryProvider = {
    id: "example",
    supported: () => true,
    snapshot: async () => [{ id: "tool", kind: "package" }],
    planMissing: () => [],
  };

  await expect(snapshotInventories([provider], dependencies)).resolves.toEqual([]);
  expect(dependencies.fs.textFiles.get(path)).toBe(contents);
});
