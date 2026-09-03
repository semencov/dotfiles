import type { OperatingSystem } from "../lib/platform";

export interface NormalizeContext {
  readonly target: string;
  readonly platform: OperatingSystem;
  readonly publicSourceAllowlist: ReadonlySet<string>;
}

export interface Normalizer {
  readonly id: string;
  readonly schemaVersion: number;
  normalize(input: Uint8Array, context: NormalizeContext): Promise<Uint8Array>;
}
