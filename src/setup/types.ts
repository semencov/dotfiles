import type { CliDependencies } from "../cli/dependencies";
import type { OperatingSystem } from "../lib/platform";

export type CheckResult =
  | { readonly ok: true; readonly detail?: string }
  | { readonly ok: false; readonly detail: string; readonly remediation?: string };

export interface TaskContext extends CliDependencies {
  readonly dryRun: boolean;
}

export interface SetupTask {
  readonly id: string;
  readonly title: string;
  readonly platforms: readonly OperatingSystem[];
  readonly dependencies: readonly string[];
  readonly defaultSelected: boolean;
  readonly risk: "low" | "medium" | "high";
  readonly privilege: "user" | "command-sudo";
  preflight(context: TaskContext): Promise<CheckResult>;
  apply(context: TaskContext): Promise<void>;
  verify(context: TaskContext): Promise<CheckResult>;
}

export type SetupPhase = "preflight" | "apply" | "verify";

export interface SetupTaskTiming {
  readonly taskId: string;
  readonly phase: SetupPhase;
  readonly durationMs: number;
}

export type SetupRunResult =
  | { readonly ok: true; readonly timings: readonly SetupTaskTiming[] }
  | {
    readonly ok: false;
    readonly taskId: string;
    readonly phase: SetupPhase;
    readonly detail: string;
    readonly remediation?: string;
    readonly timings: readonly SetupTaskTiming[];
  };
