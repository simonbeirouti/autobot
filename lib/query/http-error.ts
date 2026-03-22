export class HttpError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function isNotFoundError(error: unknown) {
  return isHttpError(error) && error.status === 404;
}

export function ensureRouteData<T>(value: T | null | undefined, message: string) {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value;
}
