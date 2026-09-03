export function decodeUtf8(input: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(input);
}

export function canonicalText(input: Uint8Array): Uint8Array {
  const value = decodeUtf8(input).replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\n+$/, "");
  return new TextEncoder().encode(`${value}\n`);
}
