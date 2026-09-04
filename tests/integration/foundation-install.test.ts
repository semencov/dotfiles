import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { seedLegacyHomeLinks } from "./fixtures/legacy-home-links";

interface CommandOutput {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ManagedTargetFixture {
  readonly target: string;
  readonly source: string;
}

const repoRoot = resolve(import.meta.dir, "../..");
const fixtureBin = join(import.meta.dir, "fixtures", "bin");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function run(
  executable: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly env?: Readonly<Record<string, string>> } = {},
): Promise<CommandOutput> {
  const child = Bun.spawn([executable, ...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

async function manifestPaths(backupRoot: string): Promise<readonly string[]> {
  try {
    const archives = await readdir(backupRoot);
    return archives.map((archive) => join(backupRoot, archive, "manifest.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function commandFailureDetail(output: CommandOutput, home: string): Promise<string> {
  if (output.exitCode === 0) return "";
  const logsDirectory = join(home, ".local", "state", "dotfiles", "logs");
  const logs = await readdir(logsDirectory).catch(() => []);
  const durable = await Promise.all(logs.map((name) => readFile(join(logsDirectory, name), "utf8")));
  return [output.stdout, output.stderr, ...durable].join("\n");
}

async function fileHash(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function snapshotPath(path: string, prefix: string): Promise<Readonly<Record<string, string>>> {
  const metadata = await lstat(path);
  if (metadata.isFile()) return { [prefix]: await fileHash(path) };
  if (!metadata.isDirectory()) return { [prefix]: `non-regular:${metadata.mode}` };

  const entries = await readdir(path);
  const children = await Promise.all(entries.sort().map((entry) => snapshotPath(
    join(path, entry),
    join(prefix, entry),
  )));
  return Object.assign({}, ...children) as Readonly<Record<string, string>>;
}

async function snapshotManagedState(
  root: string,
  targets: readonly ManagedTargetFixture[],
): Promise<Readonly<Record<string, string>>> {
  const snapshots = await Promise.all(targets.map(({ target }) => snapshotPath(join(root, target), target)));
  return Object.assign({}, ...snapshots) as Readonly<Record<string, string>>;
}

test("local bootstrap converges an isolated HOME and preserves conflicts exactly once", async () => {
  const actualBun = Bun.which("bun");
  const actualChezmoi = Bun.which("chezmoi");
  const actualGit = Bun.which("git");
  if (actualBun === null || actualChezmoi === null || actualGit === null) {
    throw new Error("Integration requires bun, chezmoi, and git");
  }

  const root = await mkdtemp(join(tmpdir(), "dotfiles-foundation-install-"));
  temporaryDirectories.push(root);
  const home = join(root, "home");
  const checkout = join(home, ".dotfiles");
  const fakeBin = join(root, "bin");
  const integrationLog = join(root, "commands.log");
  await mkdir(home, { recursive: true });
  const clone = await run(actualGit, ["clone", "--quiet", "--no-hardlinks", repoRoot, checkout]);
  expect(clone).toMatchObject({ exitCode: 0 });
  expect((await run(actualGit, ["-C", checkout, "remote", "set-url", "origin", "https://github.com/semencov/dotfiles.git"])).exitCode).toBe(0);
  await Promise.all([
    cp(join(repoRoot, "src"), join(checkout, "src"), { recursive: true, force: true }),
    cp(join(repoRoot, "home"), join(checkout, "home"), { recursive: true, force: true }),
    copyFile(join(repoRoot, "install.sh"), join(checkout, "install.sh")),
    copyFile(join(repoRoot, "bin", "dotfiles"), join(checkout, "bin", "dotfiles")),
    copyFile(join(repoRoot, ".chezmoiroot"), join(checkout, ".chezmoiroot")),
  ]);
  await rm(join(checkout, "shell"), { recursive: true, force: true });
  expect((await run(actualGit, ["-C", checkout, "checkout", "-B", "master"])).exitCode).toBe(0);
  expect((await run(actualGit, ["-C", checkout, "add", "--all"])).exitCode).toBe(0);
  const fixtureCommit = await run(actualGit, [
    "-C", checkout,
    "-c", "user.name=Dotfiles Test",
    "-c", "user.email=dotfiles-test@example.invalid",
    "commit", "--allow-empty", "-m", "test: seed current worktree",
  ]);
  expect(fixtureCommit.exitCode, fixtureCommit.stderr).toBe(0);
  const pushRemote = join(root, "push.git");
  expect((await run(actualGit, ["init", "--bare", pushRemote])).exitCode).toBe(0);
  expect((await run(actualGit, ["-C", checkout, "remote", "set-url", "--push", "origin", pushRemote])).exitCode).toBe(0);

  const targets = JSON.parse(
    await readFile(join(repoRoot, "tests", "fixtures", "expected-managed-targets.json"), "utf8"),
  ) as readonly ManagedTargetFixture[];
  await seedLegacyHomeLinks(home, checkout, targets);
  await writeFile(join(checkout, ".git", "info", "exclude"), "shell/\n", { flag: "a" });

  await mkdir(fakeBin);
  const gitWrapper = join(fakeBin, "git");
  await writeFile(gitWrapper, `#!/usr/bin/env bun
const args = Bun.argv.slice(2);
if (args.includes("fetch")) process.exit(0);
const result = Bun.spawnSync([process.env.REAL_GIT!, ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
process.exit(result.exitCode);
`);
  await chmod(gitWrapper, 0o755);
  for (const executable of ["bun", "gh"] as const) {
    const destination = join(fakeBin, executable);
    await copyFile(join(fixtureBin, executable), destination);
    await chmod(destination, 0o755);
  }
  await symlink(actualChezmoi, join(fakeBin, "chezmoi"));
  await symlink(join(repoRoot, "node_modules"), join(checkout, "node_modules"));
  await writeFile(integrationLog, "");

  const path = [fakeBin, dirname(actualGit), "/usr/bin", "/bin"].join(":");
  const environment = {
    ...process.env,
    HOME: home,
    PATH: path,
    REAL_BUN: actualBun,
    REAL_GIT: actualGit,
    INTEGRATION_LOG: integrationLog,
  } as Record<string, string>;
  delete environment.DOTFILES_TEST_EUID;
  delete environment.DOTFILES_OS_RELEASE_FILE;

  const installArgs = [
    join(checkout, "install.sh"),
    "--non-interactive",
    "--select", "core-tools,git",
    "--skip", "homebrew-packages,shell",
  ];
  const first = await run("/bin/bash", installArgs, { env: environment });
  expect(first.exitCode, await commandFailureDetail(first, home)).toBe(0);

  for (const { target } of targets) {
    const metadata = await lstat(join(home, target));
    expect(metadata.isSymbolicLink(), target).toBe(false);
    if (target === ".mackup") {
      expect(metadata.isDirectory(), target).toBe(true);
      continue;
    }
    expect(metadata.isFile(), target).toBe(true);
    const rendered = await run(actualChezmoi, [
      "--config", join(home, ".config", "chezmoi", "chezmoi.json"),
      "--source", checkout,
      "cat", join(home, target),
    ], { env: environment });
    expect(rendered.exitCode, rendered.stderr).toBe(0);
    expect(await readFile(join(home, target), "utf8"), target).toBe(rendered.stdout);
  }

  const backupRoot = join(home, ".local", "state", "dotfiles", "backups");
  const initialManifests = await manifestPaths(backupRoot);
  expect(initialManifests).toHaveLength(1);
  const initialManifest = JSON.parse(await readFile(initialManifests[0]!, "utf8")) as {
    readonly entries: readonly { readonly relativePath: string; readonly type: string }[];
  };
  expect(initialManifest.entries.map(({ relativePath, type }) => ({ relativePath, type })).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  )).toEqual(targets.map(({ target }) => ({ relativePath: target, type: "symlink" })).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  ));
  expect((await stat(dirname(initialManifests[0]!))).mode & 0o777).toBe(0o700);
  expect((await stat(initialManifests[0]!)).mode & 0o777).toBe(0o600);

  const initialHomeHashes = await snapshotManagedState(home, targets);
  const initialRepoHashes = await snapshotManagedState(
    join(checkout, "home"),
    targets.map(({ source }) => ({ target: source, source })),
  );
  const apply = async (): Promise<CommandOutput> => run(
    join(checkout, "bin", "dotfiles"),
    ["apply"],
    { env: environment },
  );

  const second = await apply();
  expect(second.exitCode, await commandFailureDetail(second, home)).toBe(0);
  expect(await manifestPaths(backupRoot)).toHaveLength(1);
  expect(await snapshotManagedState(home, targets)).toEqual(initialHomeHashes);
  expect(await snapshotManagedState(
    join(checkout, "home"),
    targets.map(({ source }) => ({ target: source, source })),
  )).toEqual(initialRepoHashes);

  const third = await apply();
  expect(third.exitCode, await commandFailureDetail(third, home)).toBe(0);
  expect(await manifestPaths(backupRoot)).toHaveLength(1);
  expect(await snapshotManagedState(home, targets)).toEqual(initialHomeHashes);
  expect(await snapshotManagedState(
    join(checkout, "home"),
    targets.map(({ source }) => ({ target: source, source })),
  )).toEqual(initialRepoHashes);
  expect(await readFile(integrationLog, "utf8")).not.toContain("brew");
}, 20_000);

const realChezmoi = Bun.which("chezmoi");
if (realChezmoi === null) {
  test.skip("real chezmoi execute-template/diff/two-apply lifecycle (requires chezmoi in PATH)", () => undefined);
} else {
  test("real chezmoi execute-template, diff, and consecutive apply lifecycle", async () => {
    const root = await mkdtemp(join(tmpdir(), "dotfiles-real-chezmoi-"));
    temporaryDirectories.push(root);
    const home = join(root, "home");
    const config = join(root, "chezmoi.json");
    await mkdir(home);
    await writeFile(config, `${JSON.stringify({
      sourceDir: repoRoot,
      mode: "file",
      template: { options: ["missingkey=error"] },
      git: { autoCommit: false, autoPush: false },
      data: { dotfiles: { version: 1, platform: process.platform === "darwin" ? "macos" : "ubuntu", selectedTasks: [] } },
    }, null, 2)}\n`);

    const prefix = ["--config", config, "--source", repoRoot, "--destination", home];
    const environment = { ...process.env, HOME: home } as Record<string, string>;
    const template = await run(realChezmoi, [...prefix, "execute-template", "{{ .chezmoi.os }}"], { env: environment });
    expect(template.exitCode, template.stderr).toBe(0);
    expect(["darwin", "linux"]).toContain(template.stdout);

    const before = await run(realChezmoi, [...prefix, "diff", "--no-pager"], { env: environment });
    expect(before.exitCode, before.stderr).toBe(0);
    expect(before.stdout.length).toBeGreaterThan(0);
    expect((await run(realChezmoi, [...prefix, "apply", "--no-tty"], { env: environment })).exitCode).toBe(0);
    expect((await run(realChezmoi, [...prefix, "diff", "--no-pager"], { env: environment })).stdout).toBe("");
    expect((await run(realChezmoi, [...prefix, "apply", "--no-tty"], { env: environment })).exitCode).toBe(0);
    expect((await run(realChezmoi, [...prefix, "diff", "--no-pager"], { env: environment })).stdout).toBe("");
  });
}
