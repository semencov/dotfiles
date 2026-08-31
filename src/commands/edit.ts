import type { CliDependencies } from "../cli/dependencies";

export type EditorEnvironment = Readonly<Record<string, string | undefined>>;

function parseCommand(value: string): readonly string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | "\"" | null = null;
  let escaped = false;

  for (const character of value.trim()) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote !== null) {
      if (character === quote) quote = null;
      else token += character;
    } else if (character === "'" || character === "\"") {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token.length > 0) {
        tokens.push(token);
        token = "";
      }
    } else {
      token += character;
    }
  }

  if (escaped || quote !== null) throw new Error("Invalid editor command: unmatched quote or escape");
  if (token.length > 0) tokens.push(token);
  if (tokens.length === 0) throw new Error("Editor command is empty");
  return tokens;
}

export async function runEditCommand(
  dependencies: CliDependencies,
  environment: EditorEnvironment = process.env,
): Promise<number> {
  const command = environment.GUI_EDITOR ?? environment.VISUAL ?? environment.EDITOR ?? "code";
  const [executable, ...args] = parseCommand(command);
  if (executable === undefined) throw new Error("Editor command is empty");
  const result = await dependencies.process.run({
    executable,
    args: [...args, dependencies.paths.repo],
    stdin: "inherit",
  });
  return result.exitCode;
}
