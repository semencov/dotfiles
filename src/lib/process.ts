import type { Logger } from "./logger";

export interface CommandSpec {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly stdin?: "inherit" | "ignore";
  readonly sensitiveArgs?: readonly number[];
}

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessRunner {
  run(spec: CommandSpec): Promise<CommandResult>;
  which(executable: string): Promise<string | null>;
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /token|secret|password|authorization|cookie|private.?key/i;

export function sanitizeCommandSpec(spec: CommandSpec): CommandSpec {
  const sensitive = new Set(spec.sensitiveArgs ?? []);
  const args = spec.args.map((argument, index) => sensitive.has(index) ? REDACTED : argument);
  const env = spec.env === undefined
    ? undefined
    : Object.fromEntries(Object.entries(spec.env).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : value,
    ]));

  return {
    executable: spec.executable,
    args,
    ...(spec.cwd === undefined ? {} : { cwd: spec.cwd }),
    ...(env === undefined ? {} : { env }),
    ...(spec.stdin === undefined ? {} : { stdin: spec.stdin }),
    ...(spec.sensitiveArgs === undefined ? {} : { sensitiveArgs: spec.sensitiveArgs }),
  };
}

function commandEnvironment(overrides: NonNullable<CommandSpec["env"]>): Record<string, string> {
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

  return { ...process.env, ...definedOverrides } as Record<string, string>;
}

export class BunProcessRunner implements ProcessRunner {
  public constructor(private readonly logger: Logger) {}

  public async run(spec: CommandSpec): Promise<CommandResult> {
    this.logger.debug("Running command", { command: sanitizeCommandSpec(spec) });

    const child = Bun.spawn([spec.executable, ...spec.args], {
      ...(spec.cwd === undefined ? {} : { cwd: spec.cwd }),
      ...(spec.env === undefined ? {} : { env: commandEnvironment(spec.env) }),
      stdin: spec.stdin === "inherit" ? "inherit" : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = new Response(child.stdout).text();
    const stderr = new Response(child.stderr).text();
    const exitCode = await child.exited;

    return { exitCode, stdout: await stdout, stderr: await stderr };
  }

  public async which(executable: string): Promise<string | null> {
    return Bun.which(executable);
  }
}
