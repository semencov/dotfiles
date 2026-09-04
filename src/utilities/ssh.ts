import { $ } from "bun";
import { chmod, copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { atomicReplace } from "./files";
import { childExit, requireTools, UtilityOperationalError, UtilityUsageError } from "./runtime";

export interface SshHost {
  readonly identifier: string;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly identityFile: string;
}

export function validateSshIdentifier(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)) throw new UtilityUsageError("Invalid SSH identifier");
  return value;
}

export function validateSshHost(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(value)) throw new UtilityUsageError("Invalid SSH host");
  return value;
}

export function renderSshHost(host: SshHost): string {
  return `Host ${host.identifier} ${host.host}\n\tHostName ${host.host}\n\tPort ${host.port}\n\tUser ${host.username}\n\tIdentityFile ${host.identityFile}\n`;
}

export async function ensurePublicKey(privateKey: string, comment: string): Promise<string> {
  const publicKey = `${privateKey}.pub`;
  if (await Bun.file(publicKey).exists()) return publicKey;
  if (await Bun.file(privateKey).exists()) throw new UtilityOperationalError(`Private key exists without public key: ${privateKey}`);
  await requireTools(["ssh-keygen"]);
  await mkdir(dirname(privateKey), { recursive: true, mode: 0o700 });
  const result = await $`ssh-keygen -f ${privateKey} -t ed25519 -C ${comment}`.nothrow();
  if (result.exitCode !== 0) childExit("ssh-keygen", result.exitCode);
  await chmod(privateKey, 0o600);
  await chmod(publicKey, 0o644);
  return publicKey;
}

export async function addSshHost(configPath: string, host: SshHost): Promise<void> {
  const current = await Bun.file(configPath).exists() ? await Bun.file(configPath).text() : "";
  const header = new RegExp(`^Host\\s+.*(?:^|\\s)${host.identifier}(?:\\s|$)`, "m");
  if (header.test(current)) return;
  await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
  if (current.length > 0) await copyFile(configPath, `${configPath}.backup-${Date.now()}`);
  const separator = current.length === 0 || current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
  await atomicReplace(configPath, new TextEncoder().encode(`${current}${separator}${renderSshHost(host)}\n`), 0o600);
}
