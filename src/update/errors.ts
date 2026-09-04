export class UpdateCancelledError extends Error {
  public constructor() {
    super("Operation cancelled");
    this.name = "UpdateCancelledError";
  }
}
