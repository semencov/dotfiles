import { expect, test } from "bun:test";
import { join } from "node:path";

const bin = join(new URL("../..", import.meta.url).pathname, "bin");
const commands = ["chromedriver", "phpserver", "rsync-from", "rsync-to", "secret-delete", "secret-get", "secret-set", "server", "ssh-add-host", "ssh-key", "teams-active"] as const;

test("every local-service utility has inert help", async () => {
  for (const name of commands) {
    const child = Bun.spawn([join(bin, name), "--help"], { stdout: "pipe", stderr: "pipe" });
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    expect(exitCode, `${name}: ${stderr}`).toBe(0);
    expect(stdout, name).toContain("Usage:");
  }
});
