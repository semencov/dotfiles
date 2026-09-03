import type { UpdateTarget } from "./types";

export class UpdateCatalog {
  public readonly targets: readonly UpdateTarget[];

  public constructor(targets: readonly UpdateTarget[]) {
    if (new Set(targets.map(({ id }) => id)).size !== targets.length) throw new TypeError("Duplicate update target ID");
    this.targets = targets;
  }
}
