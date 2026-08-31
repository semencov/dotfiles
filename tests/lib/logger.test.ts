import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DurableLogger, redact } from "../../src/lib/logger";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("redact", () => {
  test("recursively redacts secret-shaped keys", () => {
    expect(redact({
      token: "one",
      nested: { authorization: "two", safe: "visible" },
      values: [{ privateKey: "three" }],
    })).toEqual({
      token: "[REDACTED]",
      nested: { authorization: "[REDACTED]", safe: "visible" },
      values: [{ privateKey: "[REDACTED]" }],
    });
  });
});

describe("DurableLogger", () => {
  test("creates private state and log files without persisting secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "dotfiles-logger-"));
    temporaryDirectories.push(root);
    const logs = join(root, "state", "logs");
    const consoleLines: string[] = [];
    const logger = DurableLogger.create({
      logsDirectory: logs,
      now: new Date("2026-08-31T06:07:08.000Z"),
      writeConsole: (line) => consoleLines.push(line),
    });

    logger.info("Updating", { npmToken: "synthetic-token", target: "bun" });
    logger.close();

    const stateMode = (await stat(join(root, "state"))).mode & 0o777;
    const directoryMode = (await stat(logs)).mode & 0o777;
    const fileMode = (await stat(logger.path)).mode & 0o777;
    const persisted = await readFile(logger.path, "utf8");
    expect(stateMode).toBe(0o700);
    expect(directoryMode).toBe(0o700);
    expect(fileMode).toBe(0o600);
    expect(`${persisted}\n${consoleLines.join("\n")}`).not.toContain("synthetic-token");
    expect(persisted).toContain("[REDACTED]");
  });
});
