import type { InventoryItem } from "./types";

const PUBLIC_SOURCES = [
  "https://formulae.brew.sh",
  "https://github.com/",
  "https://pypi.org",
  "https://registry.npmjs.org",
  "code",
  "cursor",
  "zed",
  "claude",
] as const;

function key(item: InventoryItem): string {
  return `${item.kind}\0${item.id}\0${item.source ?? ""}\0${item.platform ?? ""}`;
}

export function canonicalInventory(items: readonly InventoryItem[]): readonly InventoryItem[] {
  const unique = new Map(items.map((item) => [key(item), item]));
  return [...unique.values()].sort((left, right) => key(left).localeCompare(key(right)));
}

export function assertPublicInventory(items: readonly InventoryItem[]): void {
  for (const item of items) {
    const privateId = /(^|[./_-])(company|internal|private)([./_-]|$)/i.test(item.id) || item.id.startsWith("@company/");
    const publicSource = item.source === undefined || PUBLIC_SOURCES.some((source) =>
      source.endsWith("/") ? item.source!.startsWith(source) : item.source === source,
    );
    if (privateId || !publicSource || item.source?.startsWith("file:") === true) {
      throw new Error(`Inventory item is not public: ${item.kind}/${item.id}`);
    }
  }
}
