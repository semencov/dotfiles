import type { OperatingSystem } from "../lib/platform";
import { resolveTaskGraph, SetupGraphError } from "./graph";
import type { SetupTask } from "./types";

export interface SelectionInput {
  readonly saved?: readonly string[];
  readonly selected: readonly string[];
  readonly skipped: readonly string[];
  readonly nonInteractive: boolean;
}

export function resolveSelection(tasks: readonly SetupTask[], input: SelectionInput): readonly string[] {
  const ids = new Set(tasks.map(({ id }) => id));
  for (const id of [...(input.saved ?? []), ...input.selected, ...input.skipped]) {
    if (!ids.has(id)) throw new SetupGraphError(`Unknown setup task: ${id}`);
  }

  const saved = input.saved === undefined ? undefined : new Set(input.saved);
  const selected = new Set(input.selected);
  const skipped = new Set(input.skipped);

  return tasks.flatMap((task) => {
    const enabled = skipped.has(task.id)
      ? false
      : selected.has(task.id)
        ? true
        : saved === undefined
          ? task.defaultSelected
          : saved.has(task.id);
    return enabled ? [task.id] : [];
  });
}

export function resolveSetupTasks(
  tasks: readonly SetupTask[],
  input: SelectionInput,
  platform: OperatingSystem,
): readonly SetupTask[] {
  return resolveTaskGraph(tasks, resolveSelection(tasks, input), platform, input.skipped);
}
