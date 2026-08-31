import { Command, CommanderError } from "commander";

import type { CliDependencies, FoundationCommandHandler } from "./dependencies";

class CommandFailedError extends Error {
  public constructor(public readonly exitCode: number) {
    super(`Command exited with status ${exitCode}`);
    this.name = "CommandFailedError";
  }
}

function invoke(handler: FoundationCommandHandler): () => Promise<void> {
  return async () => {
    const exitCode = await handler();

    if (exitCode !== 0) {
      throw new CommandFailedError(exitCode);
    }
  };
}

export function createProgram(dependencies: CliDependencies): Command {
  const program = new Command("dotfiles");

  program.exitOverride();
  program.configureOutput({
    writeOut: (output) => dependencies.logger.info(output.trimEnd()),
    writeErr: (output) => dependencies.logger.error(output.trimEnd()),
  });

  program.command("setup").description("Set up or reconfigure this machine").action(invoke(dependencies.commands.setup));
  program.command("apply").description("Apply managed home state").action(invoke(dependencies.commands.apply));
  program.command("edit").description("Open the dotfiles repository").action(invoke(dependencies.commands.edit));

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
