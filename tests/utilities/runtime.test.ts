import { expect, mock, test } from "bun:test";

import {
  ChildProcessFailure,
  UtilityCancelledError,
  UtilityUsageError,
  requireTools,
  runUtility,
} from "../../src/utilities/runtime";
import { captureUtility } from "./helpers";

test("runUtility maps typed usage errors to exit 2", async () => {
  const result = await captureUtility(() => runUtility(async () => {
    throw new UtilityUsageError("Usage: example <file>");
  }));
  expect(result).toEqual({ exitCode: 2, stdout: "", stderr: "Usage: example <file>\n" });
});

test("runUtility maps cancellation and child failures", async () => {
  expect((await captureUtility(() => runUtility(async () => {
    throw new UtilityCancelledError();
  }))).exitCode).toBe(130);
  expect((await captureUtility(() => runUtility(async () => {
    throw new ChildProcessFailure("failed", 42);
  }))).exitCode).toBe(42);
});

test("runUtility maps unknown operational failures to exit 1", async () => {
  const result = await captureUtility(() => runUtility(async () => {
    throw new Error("broken");
  }));
  expect(result).toEqual({ exitCode: 1, stdout: "", stderr: "broken\n" });
});

test("requireTools reports every unavailable dependency", async () => {
  const probe = mock(async (name: string) => name === "git");
  await expect(requireTools(["git", "missing", "other"], probe)).rejects.toThrow("missing, other");
  expect(probe).toHaveBeenCalledTimes(3);
});
