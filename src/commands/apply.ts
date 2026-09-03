import { BackupService, discoverChezmoiConflicts } from "../backups/service";
import { ChezmoiClient } from "../chezmoi/client";
import { validateSourceRepository } from "../chezmoi/config";
import { assertChezmoiReady } from "../chezmoi/readiness";
import type { ApplyCommandOptions, CliDependencies } from "../cli/dependencies";
import { ChezmoiNotConfiguredError } from "../lib/errors";
import type { CommandResult } from "../lib/process";

export interface ApplyServices {
  verifyTemplates(): Promise<CommandResult>;
  diff(): Promise<string>;
  backupConflicts(): Promise<void>;
  apply(): Promise<CommandResult>;
}

export function createApplyServices(dependencies: CliDependencies): ApplyServices {
  const client = new ChezmoiClient({
    process: dependencies.process,
    fs: dependencies.fs,
    configPath: dependencies.paths.chezmoiConfig,
    sourceDir: dependencies.paths.repo,
  });
  const backups = new BackupService({
    fs: dependencies.fs,
    homeDir: dependencies.platform.homeDir,
    backupRoot: dependencies.paths.backups,
  });

  return {
    verifyTemplates: async () => {
      await validateSourceRepository(dependencies.paths.repo, dependencies.paths.repo, dependencies.fs);
      return client.verifyTemplates();
    },
    diff: () => client.diff(),
    backupConflicts: async () => {
      const conflicts = await discoverChezmoiConflicts(
        await client.renderedTargets(),
        dependencies.fs,
        dependencies.platform.homeDir,
      );
      const archive = await backups.archive(conflicts);
      if (archive !== null) dependencies.logger.info("Archived managed-file conflicts", { archive: archive.path });
    },
    apply: () => client.apply(),
  };
}

export async function runApplyCommand(
  dependencies: CliDependencies,
  options: ApplyCommandOptions,
  services: ApplyServices = createApplyServices(dependencies),
): Promise<number> {
  try {
    await assertChezmoiReady({
      configPath: dependencies.paths.chezmoiConfig,
      expectedRepo: dependencies.paths.repo,
      fs: dependencies.fs,
    });
  } catch (error) {
    if (!(error instanceof ChezmoiNotConfiguredError)) throw error;
    dependencies.logger.error(error.message);
    return error.exitCode;
  }

  const templates = await services.verifyTemplates();
  if (templates.exitCode !== 0) {
    dependencies.logger.error("Chezmoi template validation failed", { exitCode: templates.exitCode });
    return templates.exitCode || 1;
  }

  const pending = await services.diff();
  if (pending.length === 0) {
    dependencies.logger.info("Managed home state is already converged");
    return 0;
  }
  dependencies.logger.info(pending.trimEnd());
  if (options.dryRun) return 0;

  await services.backupConflicts();
  const applied = await services.apply();
  if (applied.exitCode !== 0) {
    dependencies.logger.error("Chezmoi apply failed", { exitCode: applied.exitCode });
    return applied.exitCode || 1;
  }

  const remaining = await services.diff();
  if (remaining.length !== 0) {
    dependencies.logger.error("Managed home state did not converge after apply");
    return 1;
  }
  return 0;
}
