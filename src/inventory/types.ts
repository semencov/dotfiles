import type { CliDependencies } from "../cli/dependencies";
import type { CommandSpec } from "../lib/process";
import type { OperatingSystem, SupportedPlatform } from "../lib/platform";

export interface InventoryItem {
  readonly id: string;
  readonly kind: string;
  readonly source?: string;
  readonly platform?: OperatingSystem;
}

export interface InventoryProvider {
  readonly id: string;
  supported(platform: SupportedPlatform): boolean;
  snapshot(context: CliDependencies): Promise<readonly InventoryItem[]>;
  planMissing(desired: readonly InventoryItem[], installed: readonly InventoryItem[]): readonly CommandSpec[];
}

export interface InventoryDocument {
  readonly version: 1;
  readonly provider: string;
  readonly items: readonly InventoryItem[];
}
