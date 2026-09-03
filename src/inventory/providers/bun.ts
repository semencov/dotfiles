import { canonicalInventory } from "../filter";
import type { InventoryProvider } from "../types";
import { missing, output } from "./shared";

export function createBunProvider(): InventoryProvider {
  return {
    id: "bun",
    supported: () => true,
    snapshot: async (context) => canonicalInventory((await output(context, { executable: "bun", args: ["pm", "ls", "-g"] }))
      .split("\n").map((line) => line.match(/[├└]──\s+(@?[^@\s]+(?:\/[^@\s]+)?)@/)?.[1]).filter((id): id is string => id !== undefined)
      .map((id) => ({ id, kind: "bun-global", source: "https://registry.npmjs.org" }))),
    planMissing: (desired, installed) => missing(desired, installed, (item) => ({ executable: "bun", args: ["add", "--global", item.id] })),
  };
}
