import type { FileSystem } from "../lib/filesystem";
import type { Logger } from "../lib/logger";
import type { DotfilesPaths } from "../lib/paths";
import type { SupportedPlatform } from "../lib/platform";
import type { ProcessRunner } from "../lib/process";
import type { PromptAdapter } from "../lib/prompts";

export interface SetupCommandOptions {
  readonly nonInteractive: boolean;
  readonly select: readonly string[];
  readonly skip: readonly string[];
  readonly dryRun: boolean;
}

export interface ApplyCommandOptions {
  readonly dryRun: boolean;
}

export interface FoundationCommandHandlers {
  readonly setup: (options: SetupCommandOptions) => Promise<number>;
  readonly apply: (options: ApplyCommandOptions) => Promise<number>;
  readonly edit: () => Promise<number>;
}

export interface CliDependencies {
  readonly process: ProcessRunner;
  readonly fs: FileSystem;
  readonly prompts: PromptAdapter;
  readonly logger: Logger;
  readonly platform: SupportedPlatform;
  readonly paths: DotfilesPaths;
  readonly commands: FoundationCommandHandlers;
}
