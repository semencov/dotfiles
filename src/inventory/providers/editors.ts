import { canonicalInventory } from "../filter";
import type { InventoryProvider } from "../types";
import { lines, missing, output } from "./shared";

const EDITORS = ["code", "cursor", "zed"] as const;

export function createEditorProvider(): InventoryProvider {
  return {
    id: "editors",
    supported: () => true,
    snapshot: async (context) => {
      const items = (await Promise.all(EDITORS.map(async (source) => lines(await output(context, {
        executable: source,
        args: ["--list-extensions"],
      })).map((id) => ({ id, kind: "editor-extension", source }))))).flat();
      return canonicalInventory(items);
    },
    planMissing: (desired, installed) => missing(desired, installed, (item) => ({
      executable: item.source ?? "code",
      args: ["--install-extension", item.id],
    })),
  };
}
