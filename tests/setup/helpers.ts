import type { SetupTask } from "../../src/setup/types";

export function task(
  id: string,
  options: Partial<Omit<SetupTask, "id" | "title">> = {},
): SetupTask {
  return {
    id,
    title: id,
    platforms: ["macos", "ubuntu", "debian"],
    dependencies: [],
    defaultSelected: false,
    risk: "low",
    privilege: "user",
    mutations: [],
    preflight: async () => ({ ok: true }),
    apply: async () => undefined,
    verify: async () => ({ ok: true }),
    ...options,
  };
}
