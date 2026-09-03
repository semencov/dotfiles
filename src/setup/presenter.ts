import type { SupportedPlatform } from "../lib/platform";
import type { SetupTask } from "./types";

const PLAN_FOOTER = "After tasks: archive conflicts, apply chezmoi HOME state, verify convergence";

function displayWidth(value: string): number {
  return Array.from(value).length;
}

function pad(value: string, width: number): string {
  return `${value}${" ".repeat(width - displayWidth(value))}`;
}

function renderTable(rows: readonly (readonly string[])[]): string {
  const firstRow = rows[0];
  if (firstRow === undefined) return "";
  const widths = firstRow.map((_, column) =>
    Math.max(...rows.map((row) => displayWidth(row[column] ?? ""))),
  );

  return rows
    .map((row) => row.map((value, column) => pad(value, widths[column] ?? displayWidth(value))).join("  ").trimEnd())
    .join("\n");
}

export function renderSetupPlan(
  tasks: readonly SetupTask[],
  platform: SupportedPlatform,
  dryRun: boolean,
): string {
  const rows = [
    ["TASK", "DEPENDENCIES", "RISK", "PRIVILEGE", "MUTATIONS"],
    ...tasks.map((task) => [
      task.id,
      task.dependencies.join(", ") || "none",
      task.risk,
      task.privilege,
      task.mutations.join("; ") || "none",
    ]),
  ];
  const mode = dryRun ? "DRY RUN" : "SETUP";

  return `${mode} · ${platform.os}/${platform.arch}\n${renderTable(rows)}\n${PLAN_FOOTER}\n`;
}
