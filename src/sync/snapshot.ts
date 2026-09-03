import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

import type { FileSystem } from "../lib/filesystem";
import type { OperatingSystem } from "../lib/platform";
import type { NormalizerRegistry } from "../normalizers/registry";
import type { SyncPolicyEntry } from "../policy/types";
import type { LiveSnapshot, LiveSnapshotEntry } from "./types";

export interface LiveSnapshotServiceOptions {
  readonly fs: FileSystem;
  readonly homeDir: string;
  readonly stateRoot: string;
  readonly platform: OperatingSystem;
  readonly normalizers: NormalizerRegistry;
  readonly publicSourceAllowlist: ReadonlySet<string>;
}

function hash(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

export class LiveSnapshotService {
  readonly #options: LiveSnapshotServiceOptions;

  public constructor(options: LiveSnapshotServiceOptions) {
    this.#options = options;
  }

  public async capture(policy: readonly SyncPolicyEntry[]): Promise<LiveSnapshot> {
    const { fs, homeDir, stateRoot } = this.#options;
    await fs.mkdir(stateRoot, 0o700);
    const path = await fs.mkdtemp(join(stateRoot, "sync-"));
    await fs.chmod(path, 0o700);
    const entries: LiveSnapshotEntry[] = [];

    try {
      for (const entry of policy) {
        if (entry.classification !== "managed" || !entry.platform.includes(this.#options.platform)) continue;
        const target = join(homeDir, entry.target);
        const metadata = await fs.lstat(target);
        if (metadata === null) continue;
        if (metadata.type !== "file") throw new Error(`Managed snapshot target must be a regular file: ${entry.target}`);
        const live = await fs.readBytes(target);
        if (live.byteLength > entry.maxBytes) throw new Error(`Managed snapshot target exceeds maxBytes: ${entry.target}`);
        const contents = entry.normalizer === undefined
          ? live
          : await this.#options.normalizers.normalize(entry.normalizer, live, {
              target: entry.target,
              platform: this.#options.platform,
              publicSourceAllowlist: this.#options.publicSourceAllowlist,
            });
        const destination = join(path, entry.source);
        await fs.mkdir(dirname(destination), 0o700);
        await fs.writeBytesAtomic(destination, contents, 0o600);
        entries.push({ policy: entry, contents, hash: hash(contents), mode: metadata.mode });
      }
    } catch (error) {
      await fs.removeTree(path);
      throw error;
    }

    return { path, entries, cleanup: async () => fs.removeTree(path) };
  }
}
