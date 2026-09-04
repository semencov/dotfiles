import { expect, test } from "bun:test";

import { auditBinMigration } from "../../src/utilities/catalog";

const repo = new URL("../..", import.meta.url).pathname;

test("every bin entry has an explicit retained or deleted outcome", async () => {
  const result = await auditBinMigration(repo);

  expect(result.unclassified).toEqual([]);
  expect(result.pending.length).toBeGreaterThan(0);
});
