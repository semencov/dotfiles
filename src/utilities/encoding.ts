import { UtilityUsageError } from "./runtime";

export function unicodeCodePoint(value: string): string {
  const characters = [...value];
  if (characters.length !== 1) throw new UtilityUsageError("Usage: codepoint <character>");
  return `\\x${characters[0]!.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function escapeUtf8(value: string): string {
  return [...new TextEncoder().encode(value)]
    .map((byte) => `\\x${byte.toString(16).toUpperCase().padStart(2, "0")}`)
    .join("");
}
