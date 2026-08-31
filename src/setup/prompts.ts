import { UserCancelledError } from "../lib/errors";
import { resolveSelection, resolveSetupTasks, type SelectionInput } from "./selection";
import type { SetupTask, TaskContext } from "./types";

export type SetupPlanResult =
  | { readonly ok: true; readonly tasks: readonly SetupTask[] }
  | { readonly ok: false; readonly exitCode: 130 };

function logPlan(tasks: readonly SetupTask[], context: TaskContext): void {
  context.logger.info("Resolved setup plan", {
    tasks: tasks.map((task) => ({
      id: task.id,
      dependencies: task.dependencies,
      risk: task.risk,
      privilege: task.privilege,
    })),
  });
}

export async function prepareSetupPlan(
  tasks: readonly SetupTask[],
  input: SelectionInput,
  context: TaskContext,
): Promise<SetupPlanResult> {
  try {
    if (input.nonInteractive) {
      const resolved = resolveSetupTasks(tasks, input, context.platform.os);
      logPlan(resolved, context);
      return { ok: true, tasks: resolved };
    }

    const initialValues = resolveSelection(tasks, input);
    const selected = await context.prompts.multiselect({
      message: "Select setup subsystems",
      initialValues,
      choices: tasks
        .filter((task) => task.platforms.includes(context.platform.os))
        .map((task) => ({
          value: task.id,
          label: task.title,
          hint: `dependencies: ${task.dependencies.join(", ") || "none"}; risk: ${task.risk}; privilege: ${task.privilege}`,
        })),
    });
    const resolved = resolveSetupTasks(tasks, { ...input, saved: selected, selected: [], nonInteractive: false }, context.platform.os);
    logPlan(resolved, context);
    const confirmed = await context.prompts.confirm({ message: "Apply this setup plan?", initialValue: true });
    return confirmed ? { ok: true, tasks: resolved } : { ok: false, exitCode: 130 };
  } catch (error) {
    if (error instanceof UserCancelledError) return { ok: false, exitCode: 130 };
    throw error;
  }
}
