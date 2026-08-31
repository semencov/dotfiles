export function parseManagedTargets(output: string): readonly string[] {
  const parsed: unknown = JSON.parse(output);
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
    throw new TypeError("Chezmoi managed targets output is not a string array");
  }
  return parsed;
}
