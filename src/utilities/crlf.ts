export function hasCrlf(bytes: Uint8Array): boolean {
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 13 && bytes[index + 1] === 10) return true;
  }
  return false;
}

export function normalizeCrlf(bytes: Uint8Array): Uint8Array {
  const normalized: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 13 && bytes[index + 1] === 10) continue;
    normalized.push(bytes[index]!);
  }
  return Uint8Array.from(normalized);
}
