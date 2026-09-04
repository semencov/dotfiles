export interface ConfirmOptions {
  readonly force?: boolean;
  readonly isTTY?: boolean;
  readonly readLine?: () => Promise<string>;
}

async function readStdinLine(): Promise<string> {
  const decoder = new TextDecoder();
  let value = "";
  for await (const chunk of Bun.stdin.stream()) {
    value += decoder.decode(chunk, { stream: true });
    const lineEnd = value.search(/[\r\n]/);
    if (lineEnd >= 0) return value.slice(0, lineEnd);
  }
  return value + decoder.decode();
}

export async function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (options.force) return true;
  const isTTY = options.isTTY ?? Boolean(process.stdin.isTTY && process.stderr.isTTY);
  if (!isTTY) return false;
  process.stderr.write(`${message} [y/N] `);
  const answer = await (options.readLine ?? readStdinLine)();
  return /^(?:y|yes)$/i.test(answer.trim());
}
