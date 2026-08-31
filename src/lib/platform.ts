export type OperatingSystem = "macos" | "ubuntu" | "debian";
export type CpuArchitecture = "arm64" | "x64";

export interface SupportedPlatform {
  readonly os: OperatingSystem;
  readonly arch: CpuArchitecture;
  readonly homeDir: string;
}
