import { dirname, join } from "node:path";

import { discoverChezmoiConflicts, type BackupService } from "../backups/service";
import type { BackupArchive } from "../backups/types";
import type { FileSystem } from "../lib/filesystem";
import type { Logger } from "../lib/logger";
import type { DotfilesPaths } from "../lib/paths";
import type { OperatingSystem } from "../lib/platform";

export interface MachineConfig {
  readonly version: 1;
  readonly sourceDir: string;
  readonly platform: OperatingSystem;
  readonly selectedTasks: readonly string[];
  readonly selectedUpdates: readonly string[];
  readonly git: { readonly autoCommit: true; readonly autoPush: true };
}

export interface MachineSelections {
  readonly selectedTasks: readonly string[] | undefined;
  readonly selectedUpdates: readonly string[] | undefined;
}

function stringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

export function machineSelectionsFromConfig(value: unknown): MachineSelections {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { selectedTasks: undefined, selectedUpdates: undefined };
  }
  const data = Reflect.get(value, "data");
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { selectedTasks: undefined, selectedUpdates: undefined };
  }
  const dotfiles = Reflect.get(data, "dotfiles");
  if (dotfiles === null || typeof dotfiles !== "object" || Array.isArray(dotfiles)) {
    return { selectedTasks: undefined, selectedUpdates: undefined };
  }
  return {
    selectedTasks: stringArray(Reflect.get(dotfiles, "selectedTasks")),
    selectedUpdates: stringArray(Reflect.get(dotfiles, "selectedUpdates")),
  };
}

export function serializeChezmoiConfig(machine: MachineConfig): string {
  return `${JSON.stringify({
    sourceDir: machine.sourceDir,
    mode: "file",
    template: { options: ["missingkey=error"] },
    git: machine.git,
    data: {
      dotfiles: {
        version: machine.version,
        platform: machine.platform,
        selectedTasks: machine.selectedTasks,
        selectedUpdates: machine.selectedUpdates,
      },
    },
  }, null, 2)}\n`;
}

export async function validateSourceRepository(
  sourceDir: string,
  expectedRepo: string,
  fs: FileSystem,
): Promise<void> {
  const [actualSource, actualExpected] = await Promise.all([fs.realpath(sourceDir), fs.realpath(expectedRepo)]);
  if (actualSource !== actualExpected) {
    throw new Error(`Chezmoi source does not match the expected repository: ${sourceDir}`);
  }
  const rootFile = join(sourceDir, ".chezmoiroot");
  if (!await fs.exists(rootFile) || await fs.readText(rootFile) !== "home\n") {
    throw new Error(`Invalid .chezmoiroot in source repository: ${sourceDir}`);
  }
}

export interface InstallChezmoiConfigurationOptions {
  readonly machine: MachineConfig;
  readonly expectedRepo: string;
  readonly homeDir: string;
  readonly configPath: string;
  readonly fs: FileSystem;
  readonly backups: BackupService;
  readonly logger: Logger;
}

export interface InstallChezmoiConfigurationResult {
  readonly archive: BackupArchive | null;
  readonly staleSource: string | null;
}

export async function installChezmoiConfiguration(
  options: InstallChezmoiConfigurationOptions,
): Promise<InstallChezmoiConfigurationResult> {
  await validateSourceRepository(options.machine.sourceDir, options.expectedRepo, options.fs);
  const contents = serializeChezmoiConfig(options.machine);
  const configDirectory = dirname(options.configPath);
  const configIsCurrent = await options.fs.exists(options.configPath)
    && await options.fs.readText(options.configPath) === contents;
  const configTarget = {
    target: options.configPath,
    type: "file" as const,
    contents: new TextEncoder().encode(contents),
    reason: "chezmoi-config-migration" as const,
  };
  const candidates = await discoverChezmoiConflicts(configIsCurrent
    ? [configTarget]
    : [
        { target: join(configDirectory, "chezmoi.toml"), type: "absent", reason: "chezmoi-config-migration" },
        configTarget,
        { target: join(configDirectory, "chezmoistate.boltdb"), type: "absent", reason: "chezmoi-config-migration" },
      ], options.fs, options.homeDir);
  const archive = await options.backups.archive(candidates);

  await options.fs.mkdir(configDirectory, 0o700);
  await options.fs.writeTextAtomic(options.configPath, contents, 0o600);

  const staleSource = join(options.homeDir, ".local", "share", "chezmoi");
  const staleSourceExists = await options.fs.exists(staleSource);
  if (staleSourceExists) {
    options.logger.warn("Stale default chezmoi source was preserved", { path: staleSource });
  }

  return { archive, staleSource: staleSourceExists ? staleSource : null };
}

export function machineConfigFromPaths(
  paths: DotfilesPaths,
  platform: OperatingSystem,
  selectedTasks: readonly string[],
  selectedUpdates: readonly string[] = [],
): MachineConfig {
  return {
    version: 1,
    sourceDir: paths.repo,
    platform,
    selectedTasks,
    selectedUpdates,
    git: { autoCommit: true, autoPush: true },
  };
}
