import { dirname } from "node:path";

import { BackupService } from "../backups/service";
import {
  installChezmoiConfiguration,
  machineConfigFromPaths,
  serializeChezmoiConfig,
} from "../chezmoi/config";
import type { CliDependencies, SetupCommandOptions } from "../cli/dependencies";
import { foundationTasks } from "../setup/catalog";
import { prepareSetupPlan } from "../setup/prompts";
import { SetupRunner } from "../setup/runner";
import type { TaskContext } from "../setup/types";
import { createApplyServices, runApplyCommand } from "./apply";

function selectedTasksFromConfig(value: unknown): readonly string[] | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const data = Reflect.get(value, "data");
  if (data === null || typeof data !== "object" || Array.isArray(data)) return undefined;
  const dotfiles = Reflect.get(data, "dotfiles");
  if (dotfiles === null || typeof dotfiles !== "object" || Array.isArray(dotfiles)) return undefined;
  const selectedTasks = Reflect.get(dotfiles, "selectedTasks");
  return Array.isArray(selectedTasks) && selectedTasks.every((item) => typeof item === "string")
    ? selectedTasks
    : undefined;
}

async function loadSavedSelections(dependencies: CliDependencies): Promise<readonly string[] | undefined> {
  if (!await dependencies.fs.exists(dependencies.paths.chezmoiConfig)) return undefined;
  return selectedTasksFromConfig(JSON.parse(await dependencies.fs.readText(dependencies.paths.chezmoiConfig)));
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
      ...(saved === undefined ? {} : { saved }),
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
    const previousMachine = machineConfigFromPaths(dependencies.paths, dependencies.platform.os, saved ?? []);
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

    const machine = machineConfigFromPaths(dependencies.paths, dependencies.platform.os, selected);
    await dependencies.fs.mkdir(dirname(dependencies.paths.chezmoiConfig), 0o700);
    await dependencies.fs.writeTextAtomic(
      dependencies.paths.chezmoiConfig,
      serializeChezmoiConfig(machine),
      0o600,
    );
    return 0;
  } catch (error) {
    dependencies.logger.error("Setup failed unexpectedly", {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return 1;
  }
}
