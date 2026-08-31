import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import type { FileSystem } from "../lib/filesystem";
import type { CommandResult, ProcessRunner } from "../lib/process";
import type { RenderedTarget } from "../backups/types";
import { parseManagedTargets } from "./targets";

export interface ChezmoiClientOptions {
  readonly process: ProcessRunner;
  readonly fs: FileSystem;
  readonly configPath: string;
  readonly sourceDir: string;
}

export class ChezmoiCommandError extends Error {
  public constructor(command: string, public readonly exitCode: number) {
    super(`Chezmoi ${command} failed with exit code ${exitCode}`);
    this.name = "ChezmoiCommandError";
  }
}

export class ChezmoiClient {
  public readonly sourceDir: string;
  readonly #process: ProcessRunner;
  readonly #fs: FileSystem;
  readonly #configPath: string;

  public constructor(options: ChezmoiClientOptions) {
    this.#process = options.process;
    this.#fs = options.fs;
    this.#configPath = options.configPath;
    this.sourceDir = options.sourceDir;
  }

  public async managedTargets(): Promise<readonly string[]> {
    const result = await this.#execute("managed", ["--nul-path-separator", "--path-style", "absolute"]);
    this.#assertSuccess("managed", result);
    return parseManagedTargets(result.stdout);
  }

  public async renderedTargets(): Promise<readonly RenderedTarget[]> {
    const managed = await this.#execute("managed", [
      "--include", "files",
      "--nul-path-separator",
      "--path-style", "absolute",
    ]);
    this.#assertSuccess("managed", managed);
    const targets = parseManagedTargets(managed.stdout);

    return Promise.all(targets.map(async (target): Promise<RenderedTarget> => {
      const rendered = await this.#execute("cat", [target]);
      this.#assertSuccess("cat", rendered);
      return { target, type: "file", contents: new TextEncoder().encode(rendered.stdout) };
    }));
  }

  public async diff(): Promise<string> {
    const result = await this.#execute("diff", ["--no-pager"]);
    this.#assertSuccess("diff", result);
    return result.stdout;
  }

  public async apply(): Promise<CommandResult> {
    return this.#execute("apply", ["--no-tty"]);
  }

  public async verifyTemplates(): Promise<CommandResult> {
    return this.#execute("apply", ["--dry-run", "--no-tty"]);
  }

  public async executeWithGitDisabled(command: string, args: readonly string[] = []): Promise<CommandResult> {
    const invocationConfig = join(dirname(this.#configPath), `.batch-${randomUUID()}.json`);
    const parsed: unknown = JSON.parse(await this.#fs.readText(this.#configPath));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("Chezmoi config is not a JSON object");
    }
    const config = { ...parsed, git: { autoCommit: false, autoPush: false } };
    await this.#fs.writeTextAtomic(invocationConfig, `${JSON.stringify(config, null, 2)}\n`, 0o600);
    try {
      return await this.#execute(command, args, invocationConfig);
    } finally {
      await this.#fs.removeTree(invocationConfig);
    }
  }

  async #execute(command: string, args: readonly string[], configPath = this.#configPath): Promise<CommandResult> {
    return this.#process.run({
      executable: "chezmoi",
      args: ["--config", configPath, "--source", this.sourceDir, command, ...args],
    });
  }

  #assertSuccess(command: string, result: CommandResult): void {
    if (result.exitCode !== 0) throw new ChezmoiCommandError(command, result.exitCode);
  }
}
