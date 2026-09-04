import { expect, test } from "bun:test";
import { homedir } from "node:os";

import { archiveKind } from "../../src/utilities/archive";
import { hasCrlf, normalizeCrlf } from "../../src/utilities/crlf";
import { escapeUtf8, unicodeCodePoint } from "../../src/utilities/encoding";
import { assertSafePermissionRoot } from "../../src/utilities/files";

test("encodes Unicode without evaluating input", () => {
  expect(unicodeCodePoint("£")).toBe("\\x00A3");
  expect(escapeUtf8("£")).toBe("\\xC2\\xA3");
  expect(() => unicodeCodePoint("")).toThrow();
  expect(() => unicodeCodePoint("ab")).toThrow();
});

test("detects and normalizes CRLF byte-safely", () => {
  const input = new TextEncoder().encode("a\r\nb\r\nc\n");
  expect(hasCrlf(input)).toBe(true);
  expect(new TextDecoder().decode(normalizeCrlf(input))).toBe("a\nb\nc\n");
  expect(hasCrlf(normalizeCrlf(input))).toBe(false);
});

test("dispatches archive aliases explicitly", () => {
  expect(archiveKind("x.tbz2")).toBe("tar.bz2");
  expect(archiveKind("x.tgz")).toBe("tar.gz");
  expect(archiveKind("x.7z")).toBe("7z");
  expect(() => archiveKind("x.unknown")).toThrow("Unsupported archive");
});

test("permission reset rejects broad roots", () => {
  expect(() => assertSafePermissionRoot("/", "/repo")).toThrow();
  expect(() => assertSafePermissionRoot(homedir(), "/repo")).toThrow();
  expect(() => assertSafePermissionRoot("/repo", "/repo")).toThrow();
  expect(() => assertSafePermissionRoot("/repo/project", "/repo")).not.toThrow();
});
