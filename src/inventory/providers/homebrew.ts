import { canonicalInventory } from "../filter";
import type { InventoryProvider } from "../types";
import { lines, missing, output } from "./shared";

export function createHomebrewProvider(): InventoryProvider {
  return {
    id: "homebrew",
    supported: () => true,
    snapshot: async (context) => {
      const [formulae, casks, taps] = await Promise.all([
        output(context, { executable: "brew", args: ["list", "--formula", "-1"] }),
        output(context, { executable: "brew", args: ["list", "--cask", "-1"] }),
        output(context, { executable: "brew", args: ["tap"] }),
      ]);
      return canonicalInventory([
        ...lines(formulae).map((id) => ({ id, kind: "formula" })),
        ...lines(casks).map((id) => ({ id, kind: "cask" })),
        ...lines(taps).map((id) => ({
          id,
          kind: "tap",
          source: `https://github.com/${id.split("/")[0] === "homebrew" ? "Homebrew/homebrew-" + id.split("/")[1] : id}`,
        })),
      ]);
    },
    planMissing: (desired, installed) => missing(desired, installed, (item) => item.kind === "tap"
      ? { executable: "brew", args: ["tap", item.id] }
      : { executable: "brew", args: ["install", ...(item.kind === "cask" ? ["--cask"] : []), item.id] }),
  };
}
