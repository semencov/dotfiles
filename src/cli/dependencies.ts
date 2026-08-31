import type { FileSystem } from "../lib/filesystem";
import type { Logger } from "../lib/logger";
import type { DotfilesPaths } from "../lib/paths";
import type { SupportedPlatform } from "../lib/platform";
import type { ProcessRunner } from "../lib/process";
import type { PromptAdapter } from "../lib/prompts";

export type FoundationCommandHandler = () => Promise<number>;

export interface FoundationCommandHandlers {
  readonly setup: FoundationCommandHandler;
  readonly apply: FoundationCommandHandler;
  readonly edit: FoundationCommandHandler;
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
