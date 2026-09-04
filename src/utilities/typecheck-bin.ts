import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import ts from "typescript";

export async function typecheckBin(repository: string): Promise<readonly ts.Diagnostic[]> {
  const configPath = join(repository, "tsconfig.json");
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error !== undefined) return [loaded.error];
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, repository, undefined, configPath);
  const binDir = join(repository, "bin");
  const virtualFiles = new Map<string, string>();
  for (const entry of await readdir(binDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(binDir, entry.name);
    const contents = await Bun.file(path).text();
    if (contents.startsWith("#!/usr/bin/env bun\n")) virtualFiles.set(`${path}.ts`, path);
  }
  const rootNames = [...virtualFiles.keys()];
  const host = ts.createCompilerHost(parsed.options);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.fileExists = (fileName) => virtualFiles.has(resolve(fileName)) || fileExists(fileName);
  host.readFile = (fileName) => {
    const source = virtualFiles.get(resolve(fileName));
    return source === undefined ? readFile(fileName) : ts.sys.readFile(source);
  };
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const source = virtualFiles.get(resolve(fileName));
    if (source !== undefined) {
      const contents = ts.sys.readFile(source);
      return contents === undefined
        ? undefined
        : ts.createSourceFile(fileName, contents, languageVersion, true, ts.ScriptKind.TS);
    }
    return getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  const program = ts.createProgram({ rootNames, options: parsed.options, host });
  return ts.getPreEmitDiagnostics(program);
}

if (import.meta.main) {
  const repository = resolve(import.meta.dir, "../..");
  const diagnostics = await typecheckBin(repository);
  if (diagnostics.length > 0) {
    process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: () => repository,
      getNewLine: () => "\n",
    }));
    process.exitCode = 1;
  }
}
