import type { UpdateSelectionInput, UpdateTarget } from "./types";

export class UpdateGraphError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UpdateGraphError";
  }
}

export function resolveUpdateTargets(
  targets: readonly UpdateTarget[],
  input: UpdateSelectionInput,
): readonly UpdateTarget[] {
  const byId = new Map(targets.map((target) => [target.id, target]));
  if (byId.size !== targets.length) throw new UpdateGraphError("Duplicate update target");
  const skipped = new Set(input.skipped);
  const selected = new Set(input.selected);
  const saved = input.saved === undefined ? undefined : new Set(input.saved);
  for (const id of [...input.selected, ...input.skipped, ...(input.saved ?? [])]) {
    if (!byId.has(id)) throw new UpdateGraphError(`Unknown update target: ${id}`);
  }
  const roots = targets.filter((target) => !skipped.has(target.id) && (
    selected.has(target.id) || (saved === undefined ? target.defaultSelected : saved.has(target.id))
  ));
  const included = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string): void => {
    if (included.has(id)) return;
    if (visiting.has(id)) throw new UpdateGraphError(`Update dependency cycle at ${id}`);
    const target = byId.get(id);
    if (target === undefined) throw new UpdateGraphError(`Unknown update dependency: ${id}`);
    if (!target.platforms.includes(input.platform)) throw new UpdateGraphError(`Update target ${id} is unavailable on ${input.platform}`);
    if (skipped.has(id)) throw new UpdateGraphError(`Skipped target ${id} is required by a selected update`);
    visiting.add(id);
    for (const dependency of target.dependencies) visit(dependency);
    visiting.delete(id);
    included.add(id);
  };
  for (const root of roots) visit(root.id);
  return targets.filter(({ id }) => included.has(id));
}
