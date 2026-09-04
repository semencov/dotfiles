import { expect, test } from "bun:test";
import { join } from "node:path";

import { CommandCatalog } from "../../src/utilities/catalog";
import { commandHelp, renderCommandReference } from "../../src/utilities/docs";

const repository = new URL("../..", import.meta.url).pathname;

test("command reference is generated from the catalog and inert help", async () => {
  const catalog = await CommandCatalog.load(join(repository, "config", "commands.json"));
  const rendered = await renderCommandReference(catalog, (name) => commandHelp(repository, name));
  expect(await Bun.file(join(repository, "docs", "commands.md")).text()).toBe(rendered);
});
