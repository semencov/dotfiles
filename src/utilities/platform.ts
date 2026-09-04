import type { OperatingSystem } from "../lib/platform";
import { detectPlatform } from "../lib/platform";
import { UtilityOperationalError } from "./runtime";

function platformLabel(platforms: readonly OperatingSystem[]): string {
  if (platforms.length === 1 && platforms[0] === "macos") return "macOS";
  return platforms.join(", ");
}

export async function requirePlatform<T>(
  supported: readonly OperatingSystem[],
  operation: () => Promise<T> | T,
  current?: OperatingSystem,
): Promise<T> {
  const os = current ?? (await detectPlatform()).os;
  if (!supported.includes(os)) {
    throw new UtilityOperationalError(`This command is supported only on ${platformLabel(supported)}`);
  }
  return operation();
}
