import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { scanSecrets } from "../../src/security/secret-rules";
import { validateRepository } from "../../src/security/validate-repository";
import { PolicyRegistry } from "../../src/policy/registry";
import { FakeProcessRunner } from "../support/fakes";

const repository = resolve(import.meta.dir, "../..");

describe("repository publication validation", () => {
  test("allows an allowlisted public managed config", async () => {
    const process = new FakeProcessRunner();
    process.results.push(
      { exitCode: 0, stdout: "home/dot_zshrc\0", stderr: "" },
      { exitCode: 0, stdout: "source ~/.zshlocal\n", stderr: "" },
    );
    const policy = await PolicyRegistry.load(resolve(repository, "config/sync-policy.json"));

    await expect(validateRepository({ repository, policy, process, mode: { kind: "staged" } }))
      .resolves.toEqual([]);
  });

  test("rejects unknown managed paths without reading the working tree", async () => {
    const process = new FakeProcessRunner();
    process.results.push({ exitCode: 0, stdout: "home/dot_unknown\0", stderr: "" });
    const policy = await PolicyRegistry.load(resolve(repository, "config/sync-policy.json"));

    const findings = await validateRepository({ repository, policy, process, mode: { kind: "staged" } });

    expect(findings).toEqual([{ rule: "path-unregistered", path: "home/dot_unknown" }]);
    expect(process.commands).toHaveLength(1);
  });

  test("reads tree blobs from the requested ref", async () => {
    const process = new FakeProcessRunner();
    process.results.push(
      { exitCode: 0, stdout: "home/dot_gitconfig\0", stderr: "" },
      { exitCode: 0, stdout: "[user]\nname = Public\n", stderr: "" },
    );
    const policy = await PolicyRegistry.load(resolve(repository, "config/sync-policy.json"));

    await expect(validateRepository({ repository, policy, process, mode: { kind: "tree", ref: "abc123" } }))
      .resolves.toEqual([]);
    expect(process.commands.map(({ args }) => args)).toEqual([
      ["-C", repository, "ls-tree", "-r", "--name-only", "-z", "abc123"],
      ["-C", repository, "show", "abc123:home/dot_gitconfig"],
    ]);
  });

  test("reports secret rules without including secret bytes", () => {
    const samples = [
      ["aws-access-key", `key=AKIA${"A".repeat(16)}`],
      ["github-token", `token=ghp_${"a".repeat(36)}`],
      ["npm-token", `//registry.npmjs.org/:_authToken=npm_${"a".repeat(36)}`],
      ["private-key", "-----BEGIN " + "OPENSSH PRIVATE KEY-----"],
      ["netrc-credentials", "machine example.test login user pass" + "word secret"],
      ["auth-json", JSON.stringify({ accessToken: "synthetic-secret-value" })],
    ] as const;

    for (const [rule, contents] of samples) {
      const findings = scanSecrets("fixture", contents);
      expect(findings.some((finding) => finding.rule === rule), rule).toBe(true);
      expect(JSON.stringify(findings)).not.toContain(contents);
    }
  });

  test("rejects binary and oversized managed blobs", async () => {
    const process = new FakeProcessRunner();
    process.results.push(
      { exitCode: 0, stdout: "home/dot_zshrc\0", stderr: "" },
      { exitCode: 0, stdout: `bad\0${"x".repeat(262145)}`, stderr: "" },
    );
    const policy = await PolicyRegistry.load(resolve(repository, "config/sync-policy.json"));

    const findings = await validateRepository({ repository, policy, process, mode: { kind: "staged" } });
    expect(findings.map(({ rule }) => rule)).toEqual(["file-oversized", "file-binary"]);
  });
});
