export function parseManagedTargets(output: string): readonly string[] {
  const trimmed = output.trim();
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
      throw new TypeError("Chezmoi managed targets output is not a string array");
    }
    return parsed;
  }

  const separator = output.includes("\0") ? "\0" : "\n";
  return output.split(separator).filter((value) => value.length > 0);
}
