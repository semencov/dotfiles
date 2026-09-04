import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertMigratedBinContract, auditBinMigration } from "../../src/utilities/catalog";
import { typecheckBin } from "../../src/utilities/typecheck-bin";

const repo = new URL("../..", import.meta.url).pathname;

test("every bin entry has an explicit retained or deleted outcome", async () => {
  const result = await auditBinMigration(repo);

  expect(result.unclassified).toEqual([]);
  expect(result.pending).toEqual([]);
});

test("final bin tree satisfies the strict Bun contract", async () => {
  await expect(assertMigratedBinContract(repo)).resolves.toBeUndefined();
});

test("extensionless Bun programs are parsed as strict TypeScript", async () => {
  const repository = await mkdtemp(join(tmpdir(), "bin-types-"));
  await mkdir(join(repository, "bin"));
  await Bun.write(join(repository, "tsconfig.json"), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: "ESNext" },
  }));
  await Bun.write(join(repository, "bin", "broken"), "#!/usr/bin/env bun\nconst broken = (value) => value;\n");

  expect((await typecheckBin(repository)).map(({ code }) => code)).toContain(7006);
});
