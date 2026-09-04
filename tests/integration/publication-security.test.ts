import { afterEach, expect, test } from "bun:test";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { machineConfigFromPaths, serializeChezmoiConfig } from "../../src/chezmoi/config";
import { runSyncCommand } from "../../src/commands/sync";
import { runUpdateCommand } from "../../src/commands/update";
import type { CliDependencies } from "../../src/cli/dependencies";
import { runCli } from "../../src/cli/main";
import { snapshotInventories } from "../../src/inventory/service";
import type { InventoryProvider } from "../../src/inventory/types";
import { NodeFileSystem } from "../../src/lib/filesystem";
import { DurableLogger, type Logger } from "../../src/lib/logger";
import { createDotfilesPaths } from "../../src/lib/paths";
import { BunProcessRunner, type CommandResult, type CommandSpec, type ProcessRunner } from "../../src/lib/process";
import { FakePromptAdapter } from "../support/fakes";

const repository = resolve(import.meta.dir, "../..");
const rejectedFixtures = join(repository, "tests", "fixtures", "security", "rejected");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

class IsolatedProcessRunner implements ProcessRunner {
  readonly #delegate: BunProcessRunner;

  public constructor(private readonly homeDir: string, logger: Logger) {
    this.#delegate = new BunProcessRunner(logger);
  }

  public async run(spec: CommandSpec): Promise<CommandResult> {
    if (spec.executable === "git" && spec.args.includes("fetch")) {
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    return this.#delegate.run({
      ...spec,
      env: { ...spec.env, HOME: this.homeDir },
    });
  }

  public which(executable: string): Promise<string | null> {
    return this.#delegate.which(executable);
  }
}

async function git(args: readonly string[]): Promise<CommandResult> {
  const child = Bun.spawn(["git", ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

async function fixtureDependencies(): Promise<CliDependencies> {
  const root = await mkdtemp(join(tmpdir(), "dotfiles-publication-security-"));
  temporaryDirectories.push(root);
  const home = join(root, "home");
  const paths = createDotfilesPaths(home);
  await mkdir(home, { recursive: true });
  const clone = await git(["clone", "--quiet", "--no-hardlinks", repository, paths.repo]);
  if (clone.exitCode !== 0) throw new Error(clone.stderr);
  await git(["-C", paths.repo, "checkout", "-B", "master"]);
  await git(["-C", paths.repo, "remote", "set-url", "origin", "https://github.com/semencov/dotfiles.git"]);
  await git(["-C", paths.repo, "config", "core.hooksPath", ".githooks"]);
  await mkdir(dirname(paths.chezmoiConfig), { recursive: true });
  await writeFile(paths.chezmoiConfig, serializeChezmoiConfig(machineConfigFromPaths(
    paths,
    "macos",
    [],
    [],
  )), { mode: 0o600 });

  const logger = DurableLogger.create({ logsDirectory: paths.logs, writeConsole: () => undefined });
  const process = new IsolatedProcessRunner(home, logger);
  let dependencies: CliDependencies;
  dependencies = {
    process,
    fs: new NodeFileSystem(),
    prompts: new FakePromptAdapter(),
    logger,
    platform: { os: "macos", arch: "arm64", homeDir: home },
    paths,
    commands: {
      setup: async () => 0,
      apply: async () => 0,
      edit: async () => 0,
      sync: (options) => runSyncCommand(dependencies, options),
      update: (options) => runUpdateCommand(dependencies, options),
    },
  };
  return dependencies;
}

function renderSyntheticFixture(template: string): string {
  return template
    .replaceAll("{{TOKEN}}", "Token")
    .replaceAll("{{SYNTHETIC_SECRET}}", "synthetic-secret-value")
    .replaceAll("{{16_UPPERCASE_CHARACTERS}}", "A".repeat(16))
    .replaceAll("{{36_LOWERCASE_CHARACTERS}}", "a".repeat(36))
    .replaceAll("{{WORD}}", "word")
    .replaceAll("{{PASSWORD}}", "syntheticpassword")
    .replaceAll("{{OPENSSH}}", "OPENSSH");
}

async function durableLogs(dependencies: CliDependencies): Promise<string> {
  const files = await readdir(dependencies.paths.logs);
  return (await Promise.all(files.map((file) => readFile(join(dependencies.paths.logs, file), "utf8")))).join("\n");
}

test("legacy updater entry points are removed", async () => {
  await expect(access(join(repository, "bin", "update"))).rejects.toThrow();
  await expect(access(join(repository, "bin", "update.mjs"))).rejects.toThrow();
});

test("sync and update reject every synthetic secret without logging its bytes", async () => {
  const fixtures = (await readdir(rejectedFixtures)).sort();
  for (const fixture of fixtures) {
    const dependencies = await fixtureDependencies();
    const secret = renderSyntheticFixture(await readFile(join(rejectedFixtures, fixture), "utf8"));
    const target = join(dependencies.platform.homeDir, ".hushlogin");

    await writeFile(target, secret);
    await expect(runCli(["bun", "dotfiles", "sync", "--no-push"], dependencies)).resolves.toBe(1);
    expect(await durableLogs(dependencies)).not.toContain(secret.trim());

    await git(["-C", dependencies.paths.repo, "reset", "--hard", "HEAD"]);
    await writeFile(target, secret);
    await expect(runCli([
      "bun", "dotfiles", "update", "--non-interactive", "--no-push",
    ], dependencies)).resolves.toBe(1);
    expect(await durableLogs(dependencies)).not.toContain(secret.trim());
  }
}, 30_000);

test("unknown HOME files are ignored by sync and inventory capture", async () => {
  const dependencies = await fixtureDependencies();
  const marker = "unknown-home-marker-that-must-not-be-imported";
  const unknown = join(dependencies.platform.homeDir, ".unknown-local-state");
  await writeFile(unknown, marker);

  await expect(runCli(["bun", "dotfiles", "sync", "--no-push"], dependencies)).resolves.toBe(0);
  const provider: InventoryProvider = {
    id: "test-public",
    supported: () => true,
    snapshot: async () => [{ id: "public-tool", kind: "package" }],
    planMissing: () => [],
  };
  const written = await snapshotInventories([provider], dependencies);

  expect(await readFile(unknown, "utf8")).toBe(marker);
  expect(await readFile(written[0]!, "utf8")).not.toContain(marker);
  expect(await durableLogs(dependencies)).not.toContain(marker);
  expect((await git(["-C", dependencies.paths.repo, "ls-files"])).stdout).not.toContain("unknown-local-state");
}, 15_000);
