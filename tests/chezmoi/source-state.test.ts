import { describe, expect, test } from "bun:test";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { join } from "node:path";

interface ManagedTargetFixture {
  readonly target: string;
  readonly source: string;
  readonly legacy: string;
  readonly compatibility?: "copy";
}

const repository = join(import.meta.dir, "..", "..");
const targets = JSON.parse(
  await readFile(join(repository, "tests", "fixtures", "expected-managed-targets.json"), "utf8"),
) as ManagedTargetFixture[];

async function sourceFiles(path: string): Promise<readonly string[]> {
  const metadata = await lstat(path);
  if (metadata.isFile()) return [path];
  if (!metadata.isDirectory()) return [];
  const children = await readdir(path);
  return (await Promise.all(children.map((child) => sourceFiles(join(path, child))))).flat();
}

describe("chezmoi source state", () => {
  test("maps every legacy sync.py target to one source and compatibility symlink", async () => {
    expect(new Set(targets.map(({ target }) => target)).size).toBe(targets.length);
    expect(new Set(targets.map(({ source }) => source)).size).toBe(targets.length);

    for (const target of targets) {
      const source = join(repository, "home", target.source);
      const legacy = join(repository, target.legacy);
      if (target.compatibility === "copy") {
        expect((await lstat(legacy)).isFile()).toBe(true);
        expect(await readFile(legacy)).toEqual(await readFile(source));
      } else {
        expect((await lstat(legacy)).isSymbolicLink()).toBe(true);
        expect(await realpath(legacy)).toBe(await realpath(source));
      }
    }
  });

  test("contains no tracked token assignments or private keys", async () => {
    const forbidden = /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----|(?:^|\n)\s*(?:export\s+)?(?:HOMEBREW_GITHUB_API_TOKEN|NPM_TOKEN|JIRA_PERSONAL_TOKEN|CONFLUENCE_PERSONAL_TOKEN|BITBUCKET_HTTP_TOKEN)=/;
    for (const file of await sourceFiles(join(repository, "home"))) {
      expect(await readFile(file, "utf8")).not.toMatch(forbidden);
    }
  });

  test("keeps machine-local files unmanaged while documenting non-secret values", async () => {
    const zshrc = await readFile(join(repository, "home", "dot_zshrc"), "utf8");
    const gitconfig = await readFile(join(repository, "home", "dot_gitconfig"), "utf8");
    expect(zshrc).toContain("[ -r ~/.zshlocal ] && source ~/.zshlocal");
    expect(gitconfig).toContain("path = ~/.gitlocal");
    await expect(lstat(join(repository, "home", "dot_config", "dotfiles", "local.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(JSON.parse(await readFile(join(repository, "home", "dot_config", "dotfiles", "local.example.json"), "utf8"))).toEqual({
      projectPaths: ["~/Projects"],
      workIdentity: "optional-local-override",
    });
  });
});
