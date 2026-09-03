import type { InventoryProvider } from "../types";
import { canonicalInventory } from "../filter";
import { missing, output } from "./shared";

export function createMasProvider(): InventoryProvider {
  return { id: "mas", supported: ({ os }) => os === "macos", snapshot: async (context) => canonicalInventory((await output(context, { executable: "mas", args: ["list"] })).split("\n").map((line) => line.match(/^(\d+)\s/)?.[1]).filter((id): id is string => id !== undefined).map((id) => ({ id, kind: "mas-app", platform: "macos" }))), planMissing: (desired, installed) => missing(desired, installed, (item) => ({ executable: "mas", args: ["install", item.id] })) };
}
