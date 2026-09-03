import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";

export interface LegacyTarget {
  readonly target: string;
  readonly source: string;
}

export async function seedLegacyHomeLinks(
  home: string,
  repo: string,
  targets: readonly LegacyTarget[],
): Promise<void> {
  await mkdir(join(repo, "shell"), { recursive: true });
  for (const { target, source } of targets) {
    const legacySource = join(repo, "shell", target);
    await symlink(join("..", "home", source), legacySource);
    await symlink(join(".", ".dotfiles", "shell", target), join(home, target));
  }
}
