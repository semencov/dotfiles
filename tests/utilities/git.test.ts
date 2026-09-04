import { expect, test } from "bun:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

import { discoverDefaultBranch, previousWorkday } from "../../src/utilities/git";
import { findProject } from "../../src/utilities/projects";

test("discovers origin default branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "git-default-"));
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  await $`git init --bare ${remote}`.quiet();
  await $`git init -b trunk ${seed}`.quiet();
  await Bun.write(join(seed, "file"), "value");
  await $`git -C ${seed} add file`.quiet();
  await $`git -C ${seed} -c user.name=Test -c user.email=test@example.com commit -m init`.quiet();
  await $`git -C ${seed} remote add origin ${remote}`.quiet();
  await $`git -C ${seed} push -u origin trunk`.quiet();
  await $`git -C ${remote} symbolic-ref HEAD refs/heads/trunk`.quiet();
  await $`git -C ${seed} remote set-head origin --auto`.quiet();

  expect(await discoverDefaultBranch(seed)).toBe("trunk");
});

test("previousWorkday handles Monday and weekdays", () => {
  expect(previousWorkday(new Date("2026-09-07T12:00:00Z")).toISOString().slice(0, 10)).toBe("2026-09-04");
  expect(previousWorkday(new Date("2026-09-08T12:00:00Z")).toISOString().slice(0, 10)).toBe("2026-09-07");
});

test("findProject uses deterministic fuzzy matching", async () => {
  const root = await mkdtemp(join(tmpdir(), "projects-"));
  await Promise.all([mkdir(join(root, "alpha-dashboard")), mkdir(join(root, "alphabet"))]);
  expect(await findProject([root], "adash")).toBe(join(root, "alpha-dashboard"));
  await expect(findProject([root], "missing")).rejects.toThrow("Project not found");
});
