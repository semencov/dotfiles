export abstract class DotfilesError extends Error {
  protected constructor(message: string, public readonly exitCode: number) {
    super(message);
  }
}

export class UnsupportedPlatformError extends DotfilesError {
  public constructor(message: string) {
    super(message, 64);
    this.name = "UnsupportedPlatformError";
  }
}

export class UserCancelledError extends DotfilesError {
  public constructor() {
    super("Operation cancelled", 130);
    this.name = "UserCancelledError";
  }
}

export class CommandUnavailableError extends DotfilesError {
  public constructor(command: string) {
    super(`Command is not available yet: ${command}`, 69);
    this.name = "CommandUnavailableError";
  }
}

export function publicErrorMessage(error: unknown): string {
  return error instanceof DotfilesError ? error.message : "Unexpected dotfiles error";
}
