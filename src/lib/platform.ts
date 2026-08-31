import { readFile } from "node:fs/promises";
import { homedir } from "node:os";

import { UnsupportedPlatformError } from "./errors";

export type OperatingSystem = "macos" | "ubuntu" | "debian";
export type CpuArchitecture = "arm64" | "x64";

export interface SupportedPlatform {
  readonly os: OperatingSystem;
  readonly arch: CpuArchitecture;
  readonly homeDir: string;
}

export interface PlatformDetectionInput {
  readonly kernel?: string;
  readonly architecture?: string;
  readonly homeDir?: string;
  readonly osRelease?: string;
}

function normalizeArchitecture(architecture: string): CpuArchitecture {
  if (architecture === "arm64" || architecture === "aarch64") return "arm64";
  if (architecture === "x64" || architecture === "x86_64") return "x64";
  throw new UnsupportedPlatformError(`Unsupported architecture: ${architecture}`);
}

function linuxId(osRelease: string): "ubuntu" | "debian" {
  const idLine = osRelease.split("\n").find((line) => line.startsWith("ID="));
  const id = idLine?.slice(3).trim().replace(/^['"]|['"]$/g, "");
  if (id === "ubuntu" || id === "debian") return id;
  throw new UnsupportedPlatformError(`Unsupported Linux distribution: ${id ?? "unknown"}`);
}

export async function detectPlatform(input: PlatformDetectionInput = {}): Promise<SupportedPlatform> {
  const kernel = input.kernel ?? process.platform;
  const architecture = normalizeArchitecture(input.architecture ?? process.arch);
  const homeDir = input.homeDir ?? homedir();

  if (kernel === "darwin") return { os: "macos", arch: architecture, homeDir };
  if (kernel !== "linux") throw new UnsupportedPlatformError(`Unsupported operating system: ${kernel}`);

  const osRelease = input.osRelease ?? await readFile("/etc/os-release", "utf8");
  return { os: linuxId(osRelease), arch: architecture, homeDir };
}
