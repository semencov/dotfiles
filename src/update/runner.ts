import type { TaskContext } from "../setup/types";
import type { UpdateRunResult, UpdateSummaryEntry, UpdateTarget } from "./types";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Update failed";
}

export class UpdateRunner {
  public constructor(private readonly targets: readonly UpdateTarget[]) {}

  public async run(context: TaskContext): Promise<UpdateRunResult> {
    const summary: UpdateSummaryEntry[] = [];
    const statuses = new Map<string, UpdateSummaryEntry["status"]>();

    for (const target of this.targets) {
      const blocked = target.dependencies.find((id) => {
        const status = statuses.get(id);
        return status === "failed" || status === "skipped-dependency" || status === "unavailable";
      });
      if (blocked !== undefined) {
        const entry = { id: target.id, status: "skipped-dependency" as const, detail: blocked };
        summary.push(entry);
        statuses.set(target.id, entry.status);
        continue;
      }
      try {
        const preflight = await target.preflight(context);
        if (!preflight.ok) {
          const entry = { id: target.id, status: "unavailable" as const, detail: preflight.detail };
          summary.push(entry);
          statuses.set(target.id, entry.status);
          continue;
        }
        if (context.dryRun) {
          const entry = { id: target.id, status: "unchanged" as const };
          summary.push(entry);
          statuses.set(target.id, entry.status);
          continue;
        }
        await target.update(context);
        const verification = await target.verify(context);
        if (!verification.ok) throw new Error(verification.detail);
        const entry = { id: target.id, status: "updated" as const };
        summary.push(entry);
        statuses.set(target.id, entry.status);
      } catch (error) {
        const entry = { id: target.id, status: "failed" as const, detail: message(error) };
        summary.push(entry);
        statuses.set(target.id, entry.status);
      }
    }

    const failed = summary.some(({ status }) => status === "failed" || status === "skipped-dependency");
    return { exitCode: failed ? 1 : 0, summary };
  }
}
