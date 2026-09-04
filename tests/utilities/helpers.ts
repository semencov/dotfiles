import type { OperatingSystem } from "../../src/lib/platform";

export async function captureUtility(operation: () => Promise<void>): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  const previousExitCode = process.exitCode;
  let stdout = "";
  let stderr = "";
  process.exitCode = undefined;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  try {
    await operation();
    return { exitCode: process.exitCode ?? 0, stdout, stderr };
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
    process.exitCode = previousExitCode ?? 0;
  }
}

export async function withPlatform<T>(
  os: OperatingSystem,
  operation: (os: OperatingSystem) => Promise<T> | T,
): Promise<T> {
  return operation(os);
}
