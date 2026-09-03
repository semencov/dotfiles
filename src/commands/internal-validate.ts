import { join } from "node:path";

import type { CliDependencies } from "../cli/dependencies";
import { PolicyRegistry } from "../policy/registry";
import { validateRepository, type RepositoryValidationMode } from "../security/validate-repository";

export interface InternalValidateOptions {
  readonly staged: boolean;
  readonly tree?: string;
}

export async function runInternalValidate(
  dependencies: CliDependencies,
  options: InternalValidateOptions,
): Promise<number> {
  if (options.staged === (options.tree !== undefined)) {
    dependencies.logger.error("Choose exactly one of --staged or --tree <ref>");
    return 2;
  }
  const mode: RepositoryValidationMode = options.staged
    ? { kind: "staged" }
    : { kind: "tree", ref: options.tree! };
  const policy = await PolicyRegistry.load(join(dependencies.paths.repo, "config", "sync-policy.json"));
  const findings = await validateRepository({
    repository: dependencies.paths.repo,
    policy,
    process: dependencies.process,
    mode,
  });
  for (const finding of findings) {
    dependencies.logger.error(`${finding.rule}: ${finding.path}${finding.line === undefined ? "" : `:${finding.line}`}`);
  }
  if (findings.length > 0) dependencies.logger.error("Publication blocked; fix findings and retry");
  return findings.length === 0 ? 0 : 1;
}
