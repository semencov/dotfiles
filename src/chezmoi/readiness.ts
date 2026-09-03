import { validateSourceRepository } from "./config";
import type { FileSystem } from "../lib/filesystem";
import { ChezmoiNotConfiguredError } from "../lib/errors";

export interface ChezmoiReadinessOptions {
  readonly configPath: string;
  readonly expectedRepo: string;
  readonly fs: FileSystem;
}

interface ChezmoiConfig {
  readonly sourceDir: string;
}

function parseConfig(contents: string): ChezmoiConfig {
  const parsed: unknown = JSON.parse(contents);
  if (typeof parsed !== "object" || parsed === null || !("sourceDir" in parsed)) {
    throw new Error("missing sourceDir");
  }
  const { sourceDir } = parsed;
  if (typeof sourceDir !== "string" || sourceDir.length === 0) throw new Error("invalid sourceDir");
  return { sourceDir };
}

export async function assertChezmoiReady(options: ChezmoiReadinessOptions): Promise<void> {
  if (!await options.fs.exists(options.configPath)) {
    throw new ChezmoiNotConfiguredError();
  }

  try {
    const config = parseConfig(await options.fs.readText(options.configPath));
    const [sourceDir, expectedRepo] = await Promise.all([
      options.fs.realpath(config.sourceDir),
      options.fs.realpath(options.expectedRepo),
    ]);
    if (sourceDir !== expectedRepo) {
      throw new ChezmoiNotConfiguredError(
        "Chezmoi configuration does not use ~/.dotfiles. Run `dotfiles setup` first",
      );
    }
    await validateSourceRepository(config.sourceDir, options.expectedRepo, options.fs);
  } catch (error) {
    if (error instanceof ChezmoiNotConfiguredError) throw error;
    throw new ChezmoiNotConfiguredError(
      "Chezmoi configuration is invalid. Run `dotfiles setup` first",
    );
  }
}
