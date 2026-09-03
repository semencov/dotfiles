import type { CliDependencies } from "../../cli/dependencies";
import type { CommandSpec } from "../../lib/process";
import { canonicalInventory } from "../filter";
import type { InventoryItem } from "../types";

export async function output(context: CliDependencies, command: CommandSpec): Promise<string> {
  if (await context.process.which(command.executable) === null) return "";
  const result = await context.process.run(command);
  if (result.exitCode !== 0) throw new Error(`${command.executable} inventory failed`);
  return result.stdout;
}

export function lines(value: string): readonly string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function missing(
  desired: readonly InventoryItem[],
  installed: readonly InventoryItem[],
  command: (item: InventoryItem) => CommandSpec,
): readonly CommandSpec[] {
  const present = new Set(installed.map((item) => `${item.kind}\0${item.id}\0${item.source ?? ""}`));
  return canonicalInventory(desired)
    .filter((item) => !present.has(`${item.kind}\0${item.id}\0${item.source ?? ""}`))
    .map(command);
}
