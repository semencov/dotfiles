import type { InventoryProvider } from "../types";
import { canonicalInventory } from "../filter";
import { missing, output } from "./shared";

export function createAiProvider(): InventoryProvider {
  return {
    id: "ai",
    supported: () => true,
    snapshot: async (context) => {
      const value = await output(context, { executable: "claude", args: ["plugin", "list", "--json"] });
      if (value === "") return [];
      const parsed = JSON.parse(value) as readonly { id: string }[];
      return canonicalInventory(parsed.map(({ id }) => ({ id, kind: "ai-plugin", source: "claude" })));
    },
    planMissing: (desired, installed) => missing(desired, installed, (item) => ({
      executable: "claude",
      args: ["plugin", "install", item.id],
    })),
  };
}
