import { join } from "node:path";

export interface DotfilesPaths {
  readonly repo: string;
  readonly state: string;
  readonly logs: string;
  readonly backups: string;
  readonly chezmoiConfig: string;
  readonly localConfig: string;
}

export function createDotfilesPaths(homeDir: string): DotfilesPaths {
  const state = join(homeDir, ".local", "state", "dotfiles");
  return {
    repo: join(homeDir, ".dotfiles"),
    state,
    logs: join(state, "logs"),
    backups: join(state, "backups"),
    chezmoiConfig: join(homeDir, ".config", "chezmoi", "chezmoi.json"),
    localConfig: join(homeDir, ".config", "dotfiles", "local.json"),
  };
}
