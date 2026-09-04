import { $ } from "bun";

import { childExit, requireTools, UtilityOperationalError } from "./runtime";

const kind = "environment variable";

function account(): string {
  const value = process.env.USER;
  if (value === undefined || value.length === 0) throw new UtilityOperationalError("USER is unavailable");
  return value;
}

export async function getSecret(key: string): Promise<string> {
  await requireTools(["security"]);
  const result = await $`security find-generic-password -w -a ${account()} -D ${kind} -s ${key}`.nothrow().quiet();
  if (result.exitCode !== 0) childExit("security find-generic-password", result.exitCode);
  return result.stdout.toString().replace(/\r?\n$/, "");
}

export async function setSecret(key: string, value: string): Promise<void> {
  await requireTools(["security"]);
  const result = await $`security add-generic-password -U -a ${account()} -D ${kind} -s ${key} -w ${value}`.nothrow().quiet();
  if (result.exitCode !== 0) throw new UtilityOperationalError("Unable to write Keychain secret");
}

export async function deleteSecret(key: string): Promise<void> {
  await requireTools(["security"]);
  const result = await $`security delete-generic-password -a ${account()} -D ${kind} -s ${key}`.nothrow().quiet();
  if (result.exitCode !== 0) childExit("security delete-generic-password", result.exitCode);
}
