import { expect, test } from "bun:test";
import { join } from "node:path";

const bin = join(new URL("../..", import.meta.url).pathname, "bin");
const commands = ["cb", "clbin", "cleandropbox", "domains", "headers", "ip-geo", "ip-lan", "ip-query", "ip-wan", "update-namecheap"] as const;

test("every network utility has inert help", async () => {
  for (const name of commands) {
    const child = Bun.spawn([join(bin, name), "--help"], { stdout: "pipe", stderr: "pipe" });
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    expect(exitCode, `${name}: ${stderr}`).toBe(0);
    expect(stdout, name).toContain("Usage:");
  }
});
