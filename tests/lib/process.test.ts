import { describe, expect, test } from "bun:test";

import { BunProcessRunner, sanitizeCommandSpec } from "../../src/lib/process";
import { FakeLogger } from "../support/fakes";

describe("sanitizeCommandSpec", () => {
  test("redacts explicit argument indexes and secret environment keys", () => {
    expect(sanitizeCommandSpec({
      executable: "tool",
      args: ["login", "raw-argument-secret"],
      sensitiveArgs: [1],
      env: { PUBLIC_VALUE: "visible", NPM_TOKEN: "raw-environment-secret" },
    })).toEqual({
      executable: "tool",
      args: ["login", "[REDACTED]"],
      sensitiveArgs: [1],
      env: { PUBLIC_VALUE: "visible", NPM_TOKEN: "[REDACTED]" },
    });
  });
});

describe("BunProcessRunner", () => {
  test("captures output and returns non-zero exits without throwing", async () => {
    const logger = new FakeLogger();
    const runner = new BunProcessRunner(logger);

    const result = await runner.run({
      executable: process.execPath,
      args: ["-e", "console.log('out'); console.error('err'); process.exit(7)"],
    });

    expect(result).toEqual({ exitCode: 7, stdout: "out\n", stderr: "err\n" });
  });

  test("never sends sensitive command values to the logger", async () => {
    const logger = new FakeLogger();
    const runner = new BunProcessRunner(logger);
    const secret = "synthetic-secret-value";

    await runner.run({ executable: process.execPath, args: ["-e", "", secret], sensitiveArgs: [2] });

    expect(JSON.stringify(logger.entries)).not.toContain(secret);
    expect(JSON.stringify(logger.entries)).toContain("[REDACTED]");
  });
});
