/** Errors that are safe to show to the user verbatim. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

export class QuotaError extends UserFacingError {
  constructor(
    message: string,
    public quota: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 402, "quota_exceeded", { quota, ...details });
    this.name = "QuotaError";
  }
}

export class NotFoundError extends UserFacingError {
  constructor(what = "Resource") {
    super(`${what} not found.`, 404, "not_found");
  }
}

/** A background job failure that should not be retried. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}
