import { join } from "node:path";
import type { CliDependencies } from "../cli/dependencies";
import { assertPublicInventory, canonicalInventory } from "./filter";
import type { InventoryDocument, InventoryProvider } from "./types";

export async function snapshotInventories(providers: readonly InventoryProvider[], context: CliDependencies): Promise<readonly string[]> {
  const written: string[] = [];
  for (const provider of providers) {
    if (!provider.supported(context.platform)) continue;
    const items = canonicalInventory(await provider.snapshot(context));
    assertPublicInventory(items);
    const document: InventoryDocument = { version: 1, provider: provider.id, items };
    const path = join(context.paths.repo, "inventories", `${provider.id}.json`);
    await context.fs.mkdir(join(context.paths.repo, "inventories"), 0o755);
    await context.fs.writeTextAtomic(path, `${JSON.stringify(document, null, 2)}\n`, 0o644);
    written.push(path);
  }
  return written;
}
