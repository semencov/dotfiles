import { createCoreToolsTask } from "./tasks/core-tools";
import { createGitTask } from "./tasks/git";
import { createHomebrewTask } from "./tasks/homebrew";
import { createShellTask } from "./tasks/shell";
import type { SetupTask } from "./types";

export function foundationTasks(): readonly SetupTask[] {
  return [createCoreToolsTask(), createHomebrewTask(), createShellTask(), createGitTask()];
}
