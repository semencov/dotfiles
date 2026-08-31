import type { CheckResult, SetupPhase, SetupRunResult, SetupTask, SetupTaskTiming, TaskContext } from "./types";

type Clock = () => number;
type FailedCheckResult = Extract<CheckResult, { ok: false }>;

function failedCheck(error: unknown): FailedCheckResult {
  return {
    ok: false,
    detail: "Task operation failed unexpectedly",
    remediation: error instanceof Error ? `Review the durable log for ${error.name}` : "Review the durable log",
  };
}

export class SetupRunner {
  public constructor(private readonly now: Clock = () => performance.now()) {}

  public async run(tasks: readonly SetupTask[], context: TaskContext): Promise<SetupRunResult> {
    const timings: SetupTaskTiming[] = [];
    const preflightFailures: { task: SetupTask; result: FailedCheckResult }[] = [];

    for (const task of tasks) {
      const result = await this.#check(task, "preflight", timings, context, () => task.preflight(context));
      if (!result.ok) preflightFailures.push({ task, result });
    }

    const preflightFailure = preflightFailures[0];
    if (preflightFailure !== undefined) {
      return this.#failure(preflightFailure.task, "preflight", preflightFailure.result, timings);
    }

    for (const task of tasks) {
      const applyStarted = this.now();
      try {
        await task.apply(context);
      } catch (error) {
        timings.push({ taskId: task.id, phase: "apply", durationMs: this.now() - applyStarted });
        context.logger.error("Setup task apply failed", {
          task: task.id,
          phase: "apply",
          errorType: error instanceof Error ? error.name : typeof error,
        });
        return this.#failure(task, "apply", failedCheck(error), timings);
      }
      timings.push({ taskId: task.id, phase: "apply", durationMs: this.now() - applyStarted });

      const verification = await this.#check(task, "verify", timings, context, () => task.verify(context));
      if (!verification.ok) return this.#failure(task, "verify", verification, timings);
    }

    return { ok: true, timings };
  }

  async #check(
    task: SetupTask,
    phase: "preflight" | "verify",
    timings: SetupTaskTiming[],
    context: TaskContext,
    operation: () => Promise<CheckResult>,
  ): Promise<CheckResult> {
    const started = this.now();
    try {
      return await operation();
    } catch (error) {
      context.logger.error("Setup task check failed", {
        task: task.id,
        phase,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      return failedCheck(error);
    } finally {
      timings.push({ taskId: task.id, phase, durationMs: this.now() - started });
    }
  }

  #failure(
    task: SetupTask,
    phase: SetupPhase,
    result: FailedCheckResult,
    timings: readonly SetupTaskTiming[],
  ): SetupRunResult {
    return {
      ok: false,
      taskId: task.id,
      phase,
      detail: result.detail,
      ...(result.remediation === undefined ? {} : { remediation: result.remediation }),
      timings,
    };
  }
}
