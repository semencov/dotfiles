import type { OperatingSystem } from "../lib/platform";
import type { SetupTask } from "./types";

export class SetupGraphError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SetupGraphError";
  }
}

function taskMap(tasks: readonly SetupTask[]): ReadonlyMap<string, SetupTask> {
  const result = new Map<string, SetupTask>();
  for (const task of tasks) {
    if (result.has(task.id)) throw new SetupGraphError(`Duplicate setup task: ${task.id}`);
    result.set(task.id, task);
  }

  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (!result.has(dependency)) {
        throw new SetupGraphError(`Unknown setup task dependency: ${task.id} -> ${dependency}`);
      }
    }
  }
  return result;
}

export function resolveTaskGraph(
  tasks: readonly SetupTask[],
  selectedIds: readonly string[],
  platform: OperatingSystem,
  skippedIds: readonly string[] = [],
): readonly SetupTask[] {
  const byId = taskMap(tasks);
  const selected = new Set(selectedIds);
  const skipped = new Set(skippedIds);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const resolved: SetupTask[] = [];

  for (const id of [...selected, ...skipped]) {
    if (!byId.has(id)) throw new SetupGraphError(`Unknown setup task: ${id}`);
  }

  const visit = (id: string, ancestry: readonly string[]): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new SetupGraphError(`Setup task dependency cycle: ${[...ancestry, id].join(" -> ")}`);
    if (skipped.has(id)) throw new SetupGraphError(`Cannot skip required setup dependency: ${id}`);

    const task = byId.get(id);
    if (task === undefined) throw new SetupGraphError(`Unknown setup task: ${id}`);
    if (!task.platforms.includes(platform)) {
      throw new SetupGraphError(`Setup task is unavailable on ${platform}: ${id}`);
    }

    visiting.add(id);
    for (const dependency of task.dependencies) visit(dependency, [...ancestry, id]);
    visiting.delete(id);
    visited.add(id);
    resolved.push(task);
  };

  for (const task of tasks) {
    if (selected.has(task.id)) visit(task.id, []);
  }

  return resolved;
}
