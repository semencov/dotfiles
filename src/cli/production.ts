import type { CliDependencies } from "./dependencies";
import { runApplyCommand } from "../commands/apply";
import { runEditCommand } from "../commands/edit";
import { runSetupCommand } from "../commands/setup";
import { NodeFileSystem } from "../lib/filesystem";
import { DurableLogger } from "../lib/logger";
import { createDotfilesPaths } from "../lib/paths";
import { detectPlatform } from "../lib/platform";
import { BunProcessRunner } from "../lib/process";
import { ClackPromptAdapter } from "../lib/prompts";

export async function createProductionDependencies(): Promise<CliDependencies> {
  const platform = await detectPlatform();
  const paths = createDotfilesPaths(platform.homeDir);
  const logger = DurableLogger.create({ logsDirectory: paths.logs });

  let dependencies: CliDependencies;
  dependencies = {
    process: new BunProcessRunner(logger),
    fs: new NodeFileSystem(),
    prompts: new ClackPromptAdapter(),
    logger,
    platform,
    paths,
    commands: {
      setup: (options) => runSetupCommand(dependencies, options),
      apply: (options) => runApplyCommand(dependencies, options),
      edit: () => runEditCommand(dependencies),
    },
  };
  return dependencies;
}
