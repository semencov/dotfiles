import type { CliDependencies, FoundationCommandHandler } from "./dependencies";
import { NodeFileSystem } from "../lib/filesystem";
import { DurableLogger } from "../lib/logger";
import { createDotfilesPaths } from "../lib/paths";
import { detectPlatform } from "../lib/platform";
import { BunProcessRunner } from "../lib/process";
import { ClackPromptAdapter } from "../lib/prompts";
import { CommandUnavailableError } from "../lib/errors";

function unavailable(command: string, logger: DurableLogger): FoundationCommandHandler {
  return async () => {
    const error = new CommandUnavailableError(command);
    logger.error(error.message, { exitCode: error.exitCode, command });
    return error.exitCode;
  };
}

export async function createProductionDependencies(): Promise<CliDependencies> {
  const platform = await detectPlatform();
  const paths = createDotfilesPaths(platform.homeDir);
  const logger = DurableLogger.create({ logsDirectory: paths.logs });

  return {
    process: new BunProcessRunner(logger),
    fs: new NodeFileSystem(),
    prompts: new ClackPromptAdapter(),
    logger,
    platform,
    paths,
    commands: {
      setup: unavailable("setup", logger),
      apply: unavailable("apply", logger),
      edit: unavailable("edit", logger),
    },
  };
}
