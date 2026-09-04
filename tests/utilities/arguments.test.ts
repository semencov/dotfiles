import { expect, test } from "bun:test";

import { parseOperands } from "../../src/utilities/arguments";

test("parseOperands preserves option-looking operands after --", () => {
  expect(parseOperands(["--force", "one", "--", "--literal", "two"])).toEqual({
    options: ["--force"],
    operands: ["one", "--literal", "two"],
  });
});

test("parseOperands rejects an unsupported option", () => {
  expect(() => parseOperands(["--wat"], ["--force"])).toThrow("Unknown option: --wat");
});
