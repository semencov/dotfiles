import { Command, CommanderError } from "commander";

import type { ApplyCommandOptions, CliDependencies, SetupCommandOptions } from "./dependencies";
import { runInternalValidate, type InternalValidateOptions } from "../commands/internal-validate";

class CommandFailedError extends Error {
  public constructor(public readonly exitCode: number) {
    super(`Command exited with status ${exitCode}`);
    this.name = "CommandFailedError";
  }
}

function invoke<T>(handler: (options: T) => Promise<number>): (options: T) => Promise<void> {
  return async (options) => {
    const exitCode = await handler(options);

    if (exitCode !== 0) {
      throw new CommandFailedError(exitCode);
    }
  };
}

function setupTaskIds(values: readonly string[] | undefined): readonly string[] {
  return (values ?? []).flatMap((value) => value.split(",").map((id) => id.trim()).filter(Boolean));
}

export function createProgram(dependencies: CliDependencies): Command {
  const program = new Command("dotfiles");

  program.exitOverride();
  program.configureOutput({
    writeOut: (output) => dependencies.logger.info(output.trimEnd()),
    writeErr: (output) => dependencies.logger.error(output.trimEnd()),
  });

  program.command("setup")
    .description("Set up or reconfigure this machine")
    .option("--non-interactive", "Do not prompt")
    .option("--select <task...>", "Select setup tasks")
    .option("--skip <task...>", "Skip setup tasks")
    .option("--dry-run", "Show the plan without mutating the machine")
    .action(invoke<SetupCommandOptions>(async (options) => dependencies.commands.setup({
      nonInteractive: options.nonInteractive ?? false,
      select: setupTaskIds(options.select),
      skip: setupTaskIds(options.skip),
      dryRun: options.dryRun ?? false,
    })));
  program.command("apply")
    .description("Apply managed home state")
    .option("--dry-run", "Validate and show the pending diff")
    .action(invoke<ApplyCommandOptions>(async (options) => dependencies.commands.apply({
      dryRun: options.dryRun ?? false,
    })));
  program.command("edit")
    .description("Open the dotfiles repository")
    .action(invoke<void>(dependencies.commands.edit));
  const internal = program.command("internal", { hidden: true });
  internal.command("validate")
    .option("--staged", "Validate the Git index")
    .option("--tree <ref>", "Validate a Git tree")
    .action(invoke<InternalValidateOptions>(async (options) => runInternalValidate(dependencies, {
      staged: options.staged ?? false,
      ...(options.tree === undefined ? {} : { tree: options.tree }),
    })));

  return program;
}

export async function runCli(argv: readonly string[], dependencies: CliDependencies): Promise<number> {
  try {
    await createProgram(dependencies).parseAsync([...argv]);
    return 0;
  } catch (error) {
    if (error instanceof CommandFailedError || error instanceof CommanderError) {
      return error.exitCode;
    }

    throw error;
  }
}
