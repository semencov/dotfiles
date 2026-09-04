import { expect, test } from "bun:test";
import { join } from "node:path";

const bin = join(new URL("../..", import.meta.url).pathname, "bin");
const commands = [
  "git-cleanup", "git-diff-master", "git-fix-user", "git-fork", "git-github", "git-pager",
  "git-standup", "git-stats", "git-upstream", "git-user", "help", "pj-archive", "pj-clean",
  "repo", "starship-git-simple", "yolo",
] as const;

test("every Git/project utility has inert help", async () => {
  for (const name of commands) {
    const child = Bun.spawn([join(bin, name), "--help"], { stdout: "pipe", stderr: "pipe" });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, `${name}: ${stderr}`).toBe(0);
    expect(stdout, name).toContain("Usage:");
  }
});
