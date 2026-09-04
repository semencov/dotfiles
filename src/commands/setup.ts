import { dirname, relative } from "node:path";

import { BackupService } from "../backups/service";
import {
  installChezmoiConfiguration,
  machineConfigFromPaths,
  machineSelectionsFromConfig,
  serializeChezmoiConfig,
} from "../chezmoi/config";
import type { CliDependencies, SetupCommandOptions } from "../cli/dependencies";
import { availableInventoryProviders } from "../inventory/catalog";
import { snapshotInventories } from "../inventory/service";
import { foundationTasks } from "../setup/catalog";
import { prepareSetupPlan } from "../setup/prompts";
import { SetupRunner } from "../setup/runner";
import type { TaskContext } from "../setup/types";
import { runSyncTransaction } from "../sync/service";
import { createApplyServices, runApplyCommand } from "./apply";
import { createSyncServices } from "./sync";

export interface SetupInventoryLifecycleServices {
  sync(snapshotInventories: () => Promise<void>): Promise<{
    readonly commit: string | null;
    readonly pushed: boolean;
    readonly warnings: readonly string[];
  }>;
  snapshotInventories(): Promise<void>;
}

export async function runSetupInventoryLifecycle(services: SetupInventoryLifecycleServices) {
  return services.sync(() => services.snapshotInventories());
}

async function publishSetupInventories(dependencies: CliDependencies): Promise<number> {
  const syncServices = await createSyncServices(dependencies);
  const changedSources = new Set<string>();
  const result = await runSetupInventoryLifecycle({
    sync: (snapshot) => runSyncTransaction({
      push: true,
      dryRun: false,
      message: "setup: capture installed environment",
    }, {
      ...syncServices,
      afterApplySnapshot: async () => {
        await snapshot();
        const canonicalApply = createApplyServices(dependencies);
        const exitCode = await runApplyCommand(dependencies, { dryRun: false }, {
          ...canonicalApply,
          backupConflicts: async () => undefined,
        });
        if (exitCode !== 0) throw new Error("Managed state apply failed after inventory capture");
        return [...changedSources].sort();
      },
    }),
    snapshotInventories: async () => {
      const providers = await availableInventoryProviders(dependencies);
      const paths = await snapshotInventories(providers, dependencies);
      for (const path of paths) changedSources.add(relative(dependencies.paths.repo, path));
    },
  });
  for (const warning of result.warnings) dependencies.logger.warn(warning);
  return result.warnings.length === 0 ? 0 : 1;
}

async function loadSavedSelections(dependencies: CliDependencies) {
  if (!await dependencies.fs.exists(dependencies.paths.chezmoiConfig)) {
    return { selectedTasks: undefined, selectedUpdates: undefined };
  }
  return machineSelectionsFromConfig(JSON.parse(await dependencies.fs.readText(dependencies.paths.chezmoiConfig)));
}

export async function runSetupCommand(
  dependencies: CliDependencies,
  options: SetupCommandOptions,
): Promise<number> {
  try {
    const saved = await loadSavedSelections(dependencies);
    const context: TaskContext = {
      ...dependencies,
      dryRun: options.dryRun,
      nonInteractive: options.nonInteractive,
    };
    const plan = await prepareSetupPlan(foundationTasks(), {
      ...(saved.selectedTasks === undefined ? {} : { saved: saved.selectedTasks }),
      selected: options.select,
      skipped: options.skip,
      nonInteractive: options.nonInteractive,
    }, context);
    if (!plan.ok) return plan.exitCode;

    const backups = new BackupService({
      fs: dependencies.fs,
      homeDir: dependencies.platform.homeDir,
      backupRoot: dependencies.paths.backups,
    });
    const applyServices = createApplyServices(dependencies);
    const previousMachine = machineConfigFromPaths(
      dependencies.paths,
      dependencies.platform.os,
      saved.selectedTasks ?? [],
      saved.selectedUpdates ?? [],
    );
    const selected = plan.tasks.map(({ id }) => id);
    const runner = new SetupRunner();
    const result = await runner.run(plan.tasks, context, options.dryRun
      ? {}
      : {
          beforeApply: async () => {
            await installChezmoiConfiguration({
              machine: previousMachine,
              expectedRepo: dependencies.paths.repo,
              homeDir: dependencies.platform.homeDir,
              configPath: dependencies.paths.chezmoiConfig,
              fs: dependencies.fs,
              backups,
              logger: dependencies.logger,
            });
            await applyServices.backupConflicts();
          },
        });
    if (!result.ok) {
      dependencies.logger.error("Setup task failed", {
        task: result.taskId,
        phase: result.phase,
        detail: result.detail,
        ...(result.remediation === undefined ? {} : { remediation: result.remediation }),
      });
      return 1;
    }
    if (options.dryRun) return 0;

    const applyExitCode = await runApplyCommand(dependencies, { dryRun: false }, applyServices);
    if (applyExitCode !== 0) return applyExitCode;

    const machine = machineConfigFromPaths(
      dependencies.paths,
      dependencies.platform.os,
      selected,
      saved.selectedUpdates ?? [],
    );
    await dependencies.fs.mkdir(dirname(dependencies.paths.chezmoiConfig), 0o700);
    await dependencies.fs.writeTextAtomic(
      dependencies.paths.chezmoiConfig,
      serializeChezmoiConfig(machine),
      0o600,
    );
    return await publishSetupInventories(dependencies);
  } catch (error) {
    dependencies.logger.error(error instanceof Error ? error.message : "Setup failed unexpectedly", {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return 1;
  }
}
