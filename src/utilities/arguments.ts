import { UtilityUsageError } from "./runtime";

export interface ParsedOperands {
  readonly options: readonly string[];
  readonly operands: readonly string[];
}

export function parseOperands(args: readonly string[], supportedOptions?: readonly string[]): ParsedOperands {
  const options: string[] = [];
  const operands: string[] = [];
  let literal = false;
  for (const argument of args) {
    if (!literal && argument === "--") {
      literal = true;
      continue;
    }
    if (!literal && argument.startsWith("-")) {
      if (supportedOptions !== undefined && !supportedOptions.includes(argument)) {
        throw new UtilityUsageError(`Unknown option: ${argument}`);
      }
      options.push(argument);
    } else {
      operands.push(argument);
    }
  }
  return { options, operands };
}

export function hasHelp(args: readonly string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

export function requireOperandCount(
  operands: readonly string[],
  range: number | readonly [minimum: number, maximum: number],
  usage: string,
): void {
  const [minimum, maximum] = typeof range === "number" ? [range, range] : range;
  if (operands.length < minimum || operands.length > maximum) throw new UtilityUsageError(usage);
}
