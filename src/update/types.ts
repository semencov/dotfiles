import type { OperatingSystem } from "../lib/platform";
import type { CheckResult, TaskContext } from "../setup/types";

export interface UpdateTarget {
  readonly id: string;
  readonly title: string;
  readonly platforms: readonly OperatingSystem[];
  readonly dependencies: readonly string[];
  readonly defaultSelected: boolean;
  readonly group: string;
  preflight(context: TaskContext): Promise<CheckResult>;
  update(context: TaskContext): Promise<void>;
  verify(context: TaskContext): Promise<CheckResult>;
}

export interface UpdateSummaryEntry {
  readonly id: string;
  readonly status: "updated" | "unchanged" | "failed" | "skipped-dependency" | "unavailable";
  readonly detail?: string;
}

export interface UpdateRunResult {
  readonly exitCode: 0 | 1;
  readonly summary: readonly UpdateSummaryEntry[];
}

export interface UpdateSelectionInput {
  readonly platform: OperatingSystem;
  readonly saved?: readonly string[];
  readonly selected: readonly string[];
  readonly skipped: readonly string[];
}
