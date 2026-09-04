import { expect, test } from "bun:test";

import { availableInventoryProviders } from "../../src/inventory/catalog";
import { createFakeDependencies } from "../support/fakes";

test("availableInventoryProviders excludes providers whose native tool is absent", async () => {
  const dependencies = createFakeDependencies();
  for (const tool of ["brew", "uv", "mas", "code", "cursor", "zed", "claude"]) {
    dependencies.process.whichResults.set(tool, null);
  }

  await expect(availableInventoryProviders(dependencies)).resolves.toEqual([
    expect.objectContaining({ id: "bun" }),
    expect.objectContaining({ id: "gh" }),
  ]);
});
