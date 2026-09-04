import { expect, mock, test } from "bun:test";

import { requirePlatform } from "../../src/utilities/platform";
import { confirm } from "../../src/utilities/terminal";
import { withPlatform } from "./helpers";

test("requirePlatform rejects Linux before executing a mutation", async () => {
  const mutate = mock(() => Promise.resolve());
  await expect(withPlatform("ubuntu", (os) => requirePlatform(["macos"], mutate, os)))
    .rejects.toThrow("supported only on macOS");
  expect(mutate).not.toHaveBeenCalled();
});

test("requirePlatform executes on a supported platform", async () => {
  const mutate = mock(() => Promise.resolve("done"));
  await expect(requirePlatform(["macos"], mutate, "macos")).resolves.toBe("done");
});

test("confirm refuses non-TTY input unless forced", async () => {
  expect(await confirm("Continue?", { isTTY: false, readLine: async () => "yes" })).toBe(false);
  expect(await confirm("Continue?", { force: true, isTTY: false, readLine: async () => "no" })).toBe(true);
});

test("confirm accepts only yes or y", async () => {
  expect(await confirm("Continue?", { isTTY: true, readLine: async () => "YES" })).toBe(true);
  expect(await confirm("Continue?", { isTTY: true, readLine: async () => "no" })).toBe(false);
});
