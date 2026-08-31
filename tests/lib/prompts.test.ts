import { expect, test } from "bun:test";

import { UserCancelledError } from "../../src/lib/errors";
import { ClackPromptAdapter } from "../../src/lib/prompts";

test("ClackPromptAdapter converts cancellation into UserCancelledError", async () => {
  const cancelled = Symbol("cancelled");
  const adapter = new ClackPromptAdapter({
    confirm: async () => cancelled,
    multiselect: async () => cancelled,
    isCancel: (value) => value === cancelled,
  });

  await expect(adapter.confirm({ message: "Continue?" })).rejects.toBeInstanceOf(UserCancelledError);
});
