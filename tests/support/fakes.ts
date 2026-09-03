import type { CliDependencies, FoundationCommandHandlers } from "../../src/cli/dependencies";
import type { FileMetadata, FileSystem } from "../../src/lib/filesystem";
import type { LogFields, Logger } from "../../src/lib/logger";
import type { CommandResult, CommandSpec, ProcessRunner } from "../../src/lib/process";
import type { ConfirmPrompt, MultiSelectPrompt, PromptAdapter } from "../../src/lib/prompts";

export class FakeProcessRunner implements ProcessRunner {
  public readonly commands: CommandSpec[] = [];
  public readonly results: CommandResult[] = [];
  public readonly whichResults = new Map<string, string | null>();
  public failAfterRun: Error | undefined;
  public onRun: ((spec: CommandSpec) => void | Promise<void>) | undefined;

  public async run(spec: CommandSpec): Promise<CommandResult> {
    this.commands.push(spec);
    await this.onRun?.(spec);
    if (this.failAfterRun !== undefined) {
      const error = this.failAfterRun;
      this.failAfterRun = undefined;
      throw error;
    }
    return this.results.shift() ?? { exitCode: 0, stdout: "", stderr: "" };
  }

  public async which(executable: string): Promise<string | null> {
    if (this.whichResults.has(executable)) return this.whichResults.get(executable) ?? null;
    return `/fake/bin/${executable}`;
  }
}

export class FakeFileSystem implements FileSystem {
  public readonly textFiles: Map<string, string>;
  public readonly createdDirectories: string[] = [];

  public constructor(seed: Readonly<Record<string, string>> = {}) {
    this.textFiles = new Map(Object.entries(seed));
  }

  public async exists(path: string): Promise<boolean> { return this.textFiles.has(path); }
  public async lstat(path: string): Promise<FileMetadata | null> {
    const contents = this.textFiles.get(path);
    return contents === undefined ? null : { type: "file", mode: 0o600, size: contents.length };
  }
  public async readText(path: string): Promise<string> {
    const contents = this.textFiles.get(path);
    if (contents === undefined) throw new Error("File not found");
    return contents;
  }
  public async readBytes(path: string): Promise<Uint8Array> {
    return new TextEncoder().encode(await this.readText(path));
  }
  public async writeTextAtomic(path: string, contents: string, _mode?: number): Promise<void> {
    this.textFiles.set(path, contents);
  }
  public async writeBytesAtomic(path: string, contents: Uint8Array, _mode?: number): Promise<void> {
    this.textFiles.set(path, new TextDecoder().decode(contents));
  }
  public async mkdir(path: string, _mode?: number): Promise<void> { this.createdDirectories.push(path); }
  public async rename(_source: string, _destination: string): Promise<void> {}
  public async copyFile(_source: string, _destination: string): Promise<void> {}
  public async chmod(_path: string, _mode: number): Promise<void> {}
  public async readdir(_path: string): Promise<readonly string[]> { return []; }
  public async realpath(path: string): Promise<string> { return path; }
  public async removeEmptyDirectory(_path: string): Promise<void> {}
  public async removeTree(_path: string): Promise<void> {}
  public async mkdtemp(prefix: string): Promise<string> { return `${prefix}fake`; }
}

export interface LogEntry {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly fields?: LogFields;
}

export class FakeLogger implements Logger {
  public readonly entries: LogEntry[] = [];

  public debug(message: string, fields?: LogFields): void { this.entries.push({ level: "debug", message, ...(fields === undefined ? {} : { fields }) }); }
  public info(message: string, fields?: LogFields): void { this.entries.push({ level: "info", message, ...(fields === undefined ? {} : { fields }) }); }
  public warn(message: string, fields?: LogFields): void { this.entries.push({ level: "warn", message, ...(fields === undefined ? {} : { fields }) }); }
  public error(message: string, fields?: LogFields): void { this.entries.push({ level: "error", message, ...(fields === undefined ? {} : { fields }) }); }
}

export class FakePromptAdapter implements PromptAdapter {
  public confirmResult = true;
  public multiselectResult: readonly string[] | undefined;

  public async confirm(_prompt: ConfirmPrompt): Promise<boolean> { return this.confirmResult; }
  public async multiselect<T extends string>(prompt: MultiSelectPrompt<T>): Promise<readonly T[]> {
    return (this.multiselectResult ?? prompt.initialValues ?? []) as readonly T[];
  }
}

const successfulCommands = (): FoundationCommandHandlers => ({
  setup: async () => 0,
  apply: async () => 0,
  edit: async () => 0,
});

export interface FakeCliDependencies extends CliDependencies {
  readonly process: FakeProcessRunner;
  readonly fs: FakeFileSystem;
  readonly prompts: FakePromptAdapter;
  readonly logger: FakeLogger;
}

export function createFakeDependencies(
  commandOverrides: Partial<FoundationCommandHandlers> = {},
  files: Readonly<Record<string, string>> = {},
): FakeCliDependencies {
  return {
    process: new FakeProcessRunner(),
    fs: new FakeFileSystem(files),
    prompts: new FakePromptAdapter(),
    logger: new FakeLogger(),
    platform: { os: "macos", arch: "arm64", homeDir: "/Users/test" },
    paths: {
      repo: "/Users/test/.dotfiles",
      state: "/Users/test/.local/state/dotfiles",
      logs: "/Users/test/.local/state/dotfiles/logs",
      backups: "/Users/test/.local/state/dotfiles/backups",
      chezmoiConfig: "/Users/test/.config/chezmoi/chezmoi.json",
      localConfig: "/Users/test/.config/dotfiles/local.json",
    },
    commands: { ...successfulCommands(), ...commandOverrides },
  };
}
