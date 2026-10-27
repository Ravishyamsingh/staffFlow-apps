export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

export function notFound(message = "Resource not found") {
  return new HttpError(404, message);
}

export function badRequest(message: string, details?: unknown) {
  return new HttpError(400, message, details);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return new HttpError(403, message);
}

export function unauthorized(message = "Authentication is required") {
  return new HttpError(401, message);
}
