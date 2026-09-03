import { canonicalInventory } from "../filter";
import type { InventoryProvider } from "../types";
import { missing, output } from "./shared";

export function createUvProvider(): InventoryProvider {
  return {
    id: "uv",
    supported: () => true,
    snapshot: async (context) => canonicalInventory((await output(context, { executable: "uv", args: ["tool", "list"] }))
      .split("\n").map((line) => line.match(/^([^\s-]+)\s+v\S+/)?.[1]).filter((id): id is string => id !== undefined)
      .map((id) => ({ id, kind: "uv-tool", source: "https://pypi.org" }))),
    planMissing: (desired, installed) => missing(desired, installed, (item) => ({ executable: "uv", args: ["tool", "install", item.id] })),
  };
}
