export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (message = 'Resource not found') =>
  new HttpError(404, 'NOT_FOUND', message);

export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, 'UNAUTHORIZED', message);

export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);
