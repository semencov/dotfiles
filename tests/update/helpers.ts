import type { UpdateTarget } from "../../src/update/types";

export function updateTarget(id: string, options: Partial<Omit<UpdateTarget, "id" | "title">> = {}): UpdateTarget {
  return {
    id,
    title: id,
    platforms: ["macos", "ubuntu", "debian"],
    dependencies: [],
    defaultSelected: false,
    group: id,
    preflight: async () => ({ ok: true }),
    update: async () => undefined,
    verify: async () => ({ ok: true }),
    ...options,
  };
}
