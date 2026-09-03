import type { InventoryProvider } from "../types";
import { canonicalInventory } from "../filter";
import { missing, output } from "./shared";

export function createGhProvider(): InventoryProvider {
  return { id: "gh", supported: () => true, snapshot: async (context) => canonicalInventory((await output(context, { executable: "gh", args: ["extension", "list"] })).split("\n").map((line) => line.trim().split(/\s+/)[0]).filter((id): id is string => Boolean(id)).map((id) => ({ id, kind: "gh-extension", source: `https://github.com/${id}` }))), planMissing: (desired, installed) => missing(desired, installed, (item) => ({ executable: "gh", args: ["extension", "install", item.id] })) };
}
