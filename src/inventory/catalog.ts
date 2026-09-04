import type { CliDependencies } from "../cli/dependencies";
import { createAiProvider } from "./providers/ai";
import { createBunProvider } from "./providers/bun";
import { createEditorProvider } from "./providers/editors";
import { createGhProvider } from "./providers/gh";
import { createHomebrewProvider } from "./providers/homebrew";
import { createMasProvider } from "./providers/mas";
import { createUvProvider } from "./providers/uv";
import type { InventoryProvider } from "./types";

const providerTools: Readonly<Record<string, readonly string[]>> = {
  homebrew: ["brew"],
  bun: ["bun"],
  uv: ["uv"],
  mas: ["mas"],
  editors: ["code", "cursor", "zed"],
  gh: ["gh"],
  ai: ["claude"],
};

export function inventoryProviders(): readonly InventoryProvider[] {
  return [
    createHomebrewProvider(),
    createBunProvider(),
    createUvProvider(),
    createMasProvider(),
    createEditorProvider(),
    createGhProvider(),
    createAiProvider(),
  ];
}

export async function availableInventoryProviders(
  dependencies: CliDependencies,
): Promise<readonly InventoryProvider[]> {
  const available: InventoryProvider[] = [];
  for (const provider of inventoryProviders()) {
    if (!provider.supported(dependencies.platform)) continue;
    const tools = providerTools[provider.id] ?? [];
    let present = false;
    for (const tool of tools) {
      if (await dependencies.process.which(tool) !== null) {
        present = true;
        break;
      }
    }
    if (present) available.push(provider);
  }
  return available;
}
