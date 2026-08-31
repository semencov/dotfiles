import { chmodSync, closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { join } from "node:path";

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /token|secret|password|authorization|cookie|private.?key/i;

export function redact(value: unknown, key?: string, seen = new WeakSet<object>()): unknown {
  if (key !== undefined && SENSITIVE_KEY.test(key)) return REDACTED;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => redact(entry, undefined, seen));

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey, seen)]),
  );
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface DurableLoggerOptions {
  readonly logsDirectory: string;
  readonly now?: Date;
  readonly writeConsole?: (line: string, level: LogLevel) => void;
}

export class DurableLogger implements Logger {
  public readonly path: string;
  readonly #descriptor: number;
  readonly #writeConsole: (line: string, level: LogLevel) => void;
  #closed = false;

  private constructor(path: string, descriptor: number, writeConsole: (line: string, level: LogLevel) => void) {
    this.path = path;
    this.#descriptor = descriptor;
    this.#writeConsole = writeConsole;
  }

  public static create(options: DurableLoggerOptions): DurableLogger {
    mkdirSync(options.logsDirectory, { recursive: true, mode: 0o700 });
    chmodSync(options.logsDirectory, 0o700);
    const timestamp = (options.now ?? new Date()).toISOString().replaceAll(":", "").replaceAll(".", "");
    const path = join(options.logsDirectory, `${timestamp}.log`);
    const descriptor = openSync(path, "a", 0o600);
    chmodSync(path, 0o600);

    return new DurableLogger(path, descriptor, options.writeConsole ?? ((line, level) => {
      const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
      stream.write(`${line}\n`);
    }));
  }

  public debug(message: string, fields?: LogFields): void { this.#write("debug", message, fields); }
  public info(message: string, fields?: LogFields): void { this.#write("info", message, fields); }
  public warn(message: string, fields?: LogFields): void { this.#write("warn", message, fields); }
  public error(message: string, fields?: LogFields): void { this.#write("error", message, fields); }

  public close(): void {
    if (this.#closed) return;
    closeSync(this.#descriptor);
    this.#closed = true;
  }

  #write(level: LogLevel, message: string, fields?: LogFields): void {
    if (this.#closed) throw new Error("Cannot write to a closed logger");
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(fields === undefined ? {} : { fields: redact(fields) }),
    };
    const line = JSON.stringify(entry);
    writeSync(this.#descriptor, `${line}\n`);
    this.#writeConsole(message, level);
  }
}
