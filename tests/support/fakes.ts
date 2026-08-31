import type { CliDependencies, FoundationCommandHandlers } from "../../src/cli/dependencies";
import type { FileMetadata, FileSystem } from "../../src/lib/filesystem";
import type { LogFields, Logger } from "../../src/lib/logger";
import type { CommandResult, CommandSpec, ProcessRunner } from "../../src/lib/process";
import type { ConfirmPrompt, MultiSelectPrompt, PromptAdapter } from "../../src/lib/prompts";

export class FakeProcessRunner implements ProcessRunner {
  public readonly commands: CommandSpec[] = [];

  public async run(spec: CommandSpec): Promise<CommandResult> {
    this.commands.push(spec);
    return { exitCode: 0, stdout: "", stderr: "" };
  }

  public async which(executable: string): Promise<string | null> {
    return `/fake/bin/${executable}`;
  }
}

export class FakeFileSystem implements FileSystem {
  public async exists(_path: string): Promise<boolean> { return false; }
  public async lstat(_path: string): Promise<FileMetadata | null> { return null; }
  public async readText(_path: string): Promise<string> { throw new Error("File not found"); }
  public async readBytes(_path: string): Promise<Uint8Array> { throw new Error("File not found"); }
  public async writeTextAtomic(_path: string, _contents: string, _mode?: number): Promise<void> {}
  public async writeBytesAtomic(_path: string, _contents: Uint8Array, _mode?: number): Promise<void> {}
  public async mkdir(_path: string, _mode?: number): Promise<void> {}
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
  public async confirm(_prompt: ConfirmPrompt): Promise<boolean> { return true; }
  public async multiselect<T extends string>(prompt: MultiSelectPrompt<T>): Promise<readonly T[]> {
    return prompt.initialValues ?? [];
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

export function createFakeDependencies(): FakeCliDependencies {
  return {
    process: new FakeProcessRunner(),
    fs: new FakeFileSystem(),
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
    commands: successfulCommands(),
  };
}
