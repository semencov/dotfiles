import { expect, test } from "bun:test";

import { createBunProvider } from "../../src/inventory/providers/bun";
import { createEditorProvider } from "../../src/inventory/providers/editors";
import { createHomebrewProvider } from "../../src/inventory/providers/homebrew";
import { createUvProvider } from "../../src/inventory/providers/uv";
import { createFakeDependencies } from "../support/fakes";

test("Homebrew snapshots formulae, casks, and taps and plans only missing installs", async () => {
  const context = createFakeDependencies();
  context.process.results.push(
    { exitCode: 0, stdout: "git\nbun\n", stderr: "" },
    { exitCode: 0, stdout: "firefox\n", stderr: "" },
    { exitCode: 0, stdout: "homebrew/core\n", stderr: "" },
  );
  const provider = createHomebrewProvider();
  const installed = await provider.snapshot(context);
  expect(installed).toEqual([
    { id: "firefox", kind: "cask" },
    { id: "bun", kind: "formula" },
    { id: "git", kind: "formula" },
    { id: "homebrew/core", kind: "tap", source: "https://github.com/Homebrew/homebrew-core" },
  ]);
  expect(provider.planMissing([
    ...installed,
    { id: "jq", kind: "formula" },
  ], installed)).toEqual([{ executable: "brew", args: ["install", "jq"] }]);
});

test("Bun and uv parsers omit versions and create install-only plans", async () => {
  const context = createFakeDependencies();
  context.process.results.push(
    { exitCode: 0, stdout: "/Users/test/.bun/install/global node_modules\n├── prettier@3.6.2\n└── typescript@6.0.0\n", stderr: "" },
    { exitCode: 0, stdout: "ruff v0.12.0\n- ruff\nhttpie v3.2.4\n", stderr: "" },
  );
  expect(await createBunProvider().snapshot(context)).toEqual([
    { id: "prettier", kind: "bun-global", source: "https://registry.npmjs.org" },
    { id: "typescript", kind: "bun-global", source: "https://registry.npmjs.org" },
  ]);
  expect(await createUvProvider().snapshot(context)).toEqual([
    { id: "httpie", kind: "uv-tool", source: "https://pypi.org" },
    { id: "ruff", kind: "uv-tool", source: "https://pypi.org" },
  ]);
});

test("editor provider records the owning public CLI", async () => {
  const context = createFakeDependencies();
  context.process.whichResults.set("code", "/bin/code");
  context.process.whichResults.set("cursor", null);
  context.process.whichResults.set("zed", null);
  context.process.results.push({ exitCode: 0, stdout: "dbaeumer.vscode-eslint\n", stderr: "" });
  expect(await createEditorProvider().snapshot(context)).toEqual([{
    id: "dbaeumer.vscode-eslint",
    kind: "editor-extension",
    source: "code",
  }]);
});
