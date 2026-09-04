import { dirname, relative } from "node:path";

import {
  machineConfigFromPaths,
  machineSelectionsFromConfig,
  serializeChezmoiConfig,
} from "../chezmoi/config";
import type { CliDependencies, UpdateCommandOptions } from "../cli/dependencies";
import { inventoryProviders } from "../inventory/catalog";
import { snapshotInventories } from "../inventory/service";
import type { InventoryProvider } from "../inventory/types";
import type { TaskContext } from "../setup/types";
import { runSyncTransaction } from "../sync/service";
import type { SyncResult } from "../sync/types";
import { resolveUpdateTargets } from "../update/graph";
import { UpdateRunner } from "../update/runner";
import { updateTargets } from "../update/targets";
import type { UpdateRunResult, UpdateSummaryEntry } from "../update/types";
import { createApplyServices, runApplyCommand } from "./apply";
import { createSyncServices } from "./sync";

export interface UpdateLifecycleServices {
  sync(afterApply: () => Promise<void>): Promise<UpdatePublicationResult>;
  applyManagedState(): Promise<void>;
  runTargets(): Promise<UpdateRunResult>;
  snapshotInventories(summary: readonly UpdateSummaryEntry[]): Promise<void>;
  captureFinalConfig(): Promise<void>;
}

export type UpdatePublicationResult = Pick<SyncResult, "commit" | "pushed" | "warnings">
  & Partial<Pick<SyncResult, "changedSources">>;

export interface UpdateLifecycleResult {
  readonly exitCode: 0 | 1 | 130;
  readonly summary: readonly UpdateSummaryEntry[];
  readonly publication: UpdatePublicationResult;
}

export async function runUpdateLifecycle(services: UpdateLifecycleServices): Promise<UpdateLifecycleResult> {
  let updates: UpdateRunResult = { exitCode: 0, summary: [] };
  const publication = await services.sync(async () => {
    await services.applyManagedState();
    updates = await services.runTargets();
    let inventoryError: unknown;
    try {
      await services.snapshotInventories(updates.summary);
    } catch (error) {
      inventoryError = error;
    }
    await services.captureFinalConfig();
    if (inventoryError !== undefined) throw inventoryError;
  });
  const publicationFailed = publication.warnings.length > 0;
  return {
    exitCode: updates.exitCode === 0 ? (publicationFailed ? 1 : 0) : updates.exitCode,
    summary: updates.summary,
    publication,
  };
}

const updateTargetByProvider: Readonly<Record<string, string>> = {
  homebrew: "homebrew",
  bun: "bun-globals",
  uv: "uv-tools",
  editors: "editor-extensions",
  gh: "gh-extensions",
  mas: "mas-apps",
  ai: "ai-tools",
};
const providerByTarget = new Map<string, InventoryProvider>(inventoryProviders().map((provider) => [
  updateTargetByProvider[provider.id]!,
  provider,
]));

async function loadMachineSelections(dependencies: CliDependencies) {
  if (!await dependencies.fs.exists(dependencies.paths.chezmoiConfig)) {
    return { selectedTasks: undefined, selectedUpdates: undefined };
  }
  return machineSelectionsFromConfig(JSON.parse(await dependencies.fs.readText(dependencies.paths.chezmoiConfig)));
}

function successfulProviders(summary: readonly UpdateSummaryEntry[]): readonly InventoryProvider[] {
  return summary.flatMap((entry) => {
    if (entry.status !== "updated" && entry.status !== "unchanged") return [];
    const provider = providerByTarget.get(entry.id);
    return provider === undefined ? [] : [provider];
  });
}

function renderSummary(summary: readonly UpdateSummaryEntry[]): string {
  return summary.map(({ id, status, detail }) => `${id}\t${status}${detail === undefined ? "" : `\t${detail}`}`).join("\n");
}

export async function runUpdateCommand(
  dependencies: CliDependencies,
  options: UpdateCommandOptions,
): Promise<number> {
  try {
    const saved = await loadMachineSelections(dependencies);
    const targets = resolveUpdateTargets(updateTargets(), {
      platform: dependencies.platform.os,
      ...(saved.selectedUpdates === undefined ? {} : { saved: saved.selectedUpdates }),
      selected: options.select,
      skipped: options.skip,
    });
    dependencies.logger.info("Update plan", {
      dryRun: options.dryRun,
      targets: targets.map(({ id, group, dependencies: targetDependencies }) => ({
        id,
        group,
        dependencies: targetDependencies,
      })),
    });

    const context: TaskContext = {
      ...dependencies,
      dryRun: options.dryRun,
      nonInteractive: options.nonInteractive,
    };
    const syncServices = await createSyncServices(dependencies);
    const changedSources = new Set<string>();
    const result = await runUpdateLifecycle({
      sync: (afterApply) => runSyncTransaction({
        push: options.push,
        dryRun: options.dryRun,
        message: "update: managed environment state",
      }, {
        ...syncServices,
        afterApplySnapshot: async () => {
          await afterApply();
          return [...changedSources].sort();
        },
      }),
      applyManagedState: async () => {
        const exitCode = await runApplyCommand(dependencies, { dryRun: false }, createApplyServices(dependencies));
        if (exitCode !== 0) throw new Error("Managed state apply failed");
      },
      runTargets: () => new UpdateRunner(targets).run(context),
      snapshotInventories: async (summary) => {
        const paths = await snapshotInventories(successfulProviders(summary), dependencies);
        for (const path of paths) changedSources.add(relative(dependencies.paths.repo, path));
      },
      captureFinalConfig: async () => {
        const finalServices = await createSyncServices(dependencies);
        const snapshot = await finalServices.capture();
        try {
          for (const source of await finalServices.applySnapshot(snapshot, false)) changedSources.add(source);
        } finally {
          await snapshot.cleanup();
        }
      },
    });

    dependencies.logger.info(`Update summary${result.summary.length === 0 ? "" : `\n${renderSummary(result.summary)}`}`);
    for (const warning of result.publication.warnings) dependencies.logger.warn(warning);
    if (!options.dryRun && result.exitCode === 0) {
      const machine = machineConfigFromPaths(
        dependencies.paths,
        dependencies.platform.os,
        saved.selectedTasks ?? [],
        targets.map(({ id }) => id),
      );
      await dependencies.fs.mkdir(dirname(dependencies.paths.chezmoiConfig), 0o700);
      await dependencies.fs.writeTextAtomic(
        dependencies.paths.chezmoiConfig,
        serializeChezmoiConfig(machine),
        0o600,
      );
    }
    return result.exitCode;
  } catch (error) {
    dependencies.logger.error(error instanceof Error ? error.message : "Update failed");
    return 1;
  }
}
