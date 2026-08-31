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
