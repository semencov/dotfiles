import type { CommandSpec } from "../../lib/process";
import type { OperatingSystem } from "../../lib/platform";
import type { CheckResult, TaskContext } from "../../setup/types";
import type { UpdateTarget } from "../types";

export interface CommandUpdateOptions {
  readonly id: string;
  readonly title: string;
  readonly tool: string;
  readonly commands: (context: TaskContext) => readonly CommandSpec[];
  readonly platforms?: readonly OperatingSystem[];
  readonly dependencies?: readonly string[];
  readonly defaultSelected?: boolean;
  readonly group?: string;
}

export async function runCommands(context: TaskContext, commands: readonly CommandSpec[]): Promise<void> {
  for (const command of commands) {
    const result = await context.process.run(command);
    if (result.exitCode !== 0) throw new Error(`${command.executable} update failed with exit code ${result.exitCode}`);
  }
}

export function commandUpdate(options: CommandUpdateOptions): UpdateTarget {
  const platforms = options.platforms ?? ["macos", "ubuntu", "debian"];
  return {
    id: options.id,
    title: options.title,
    platforms,
    dependencies: options.dependencies ?? [],
    defaultSelected: options.defaultSelected ?? true,
    group: options.group ?? options.id,
    preflight: async (context): Promise<CheckResult> => {
      if (!platforms.includes(context.platform.os)) return { ok: false, detail: `${options.id} is unavailable on ${context.platform.os}` };
      return await context.process.which(options.tool) === null
        ? { ok: false, detail: `${options.tool} is unavailable` }
        : { ok: true };
    },
    update: async (context) => runCommands(context, options.commands(context)),
    verify: async () => ({ ok: true }),
  };
}
