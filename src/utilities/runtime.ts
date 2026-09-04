import { $ } from "bun";

export class UtilityUsageError extends Error {
  readonly exitCode = 2;
}

export class UtilityOperationalError extends Error {
  readonly exitCode = 1;
}

export class UtilityCancelledError extends Error {
  readonly exitCode = 130;

  constructor(message = "Cancelled") {
    super(message);
  }
}

export class ChildProcessFailure extends Error {
  constructor(message: string, readonly exitCode: number) {
    super(message);
  }
}

export class UtilityDependencyError extends UtilityOperationalError {
  constructor(readonly missing: readonly string[]) {
    super(`Missing required tools: ${missing.join(", ")}`);
  }
}

interface UtilityFailure {
  readonly message: string;
  readonly exitCode: number;
}

function toUtilityFailure(error: unknown): UtilityFailure {
  if (
    error instanceof UtilityUsageError
    || error instanceof UtilityOperationalError
    || error instanceof UtilityCancelledError
    || error instanceof ChildProcessFailure
  ) return error;
  if (error instanceof Error) return { message: error.message, exitCode: 1 };
  return { message: "Utility failed", exitCode: 1 };
}

export async function runUtility(operation: () => Promise<number | void>): Promise<void> {
  try {
    process.exitCode = await operation() ?? 0;
  } catch (error) {
    const failure = toUtilityFailure(error);
    process.stderr.write(`${failure.message}\n`);
    process.exitCode = failure.exitCode;
  }
}

export type ToolProbe = (name: string) => Promise<boolean>;

async function probeTool(name: string): Promise<boolean> {
  return (await $`which ${name}`.nothrow().quiet()).exitCode === 0;
}

export async function requireTools(names: readonly string[], probe: ToolProbe = probeTool): Promise<void> {
  const missing: string[] = [];
  for (const name of names) {
    if (!await probe(name)) missing.push(name);
  }
  if (missing.length > 0) throw new UtilityDependencyError(missing);
}

export function childExit(command: string, exitCode: number): never {
  throw new ChildProcessFailure(`${command} exited with status ${exitCode}`, exitCode);
}
