export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, options?: { code?: string; status?: number; details?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.code = options?.code ?? 'APP_ERROR';
    this.status = options?.status ?? 500;
    this.details = options?.details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { code: 'NOT_FOUND', status: 404, details });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, details });
    this.name = 'ValidationError';
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null
      },
      status: error.status
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null
    },
    status: 500
  };
}