/** Stable business error codes. The UI translates them to Spanish (apps/web/src/i18n/es.ts). */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  PLAN_LIMIT: 'PLAN_LIMIT',
  NOT_FOUND: 'NOT_FOUND',
  FILAMENT_NOT_FOUND: 'FILAMENT_NOT_FOUND',
  SPOOL_NOT_FOUND: 'SPOOL_NOT_FOUND',
  INSUFFICIENT_FILAMENT: 'INSUFFICIENT_FILAMENT',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status for each code (docs/08 › Forma de la API). */
export const errorHttpStatus: Record<ErrorCode, 400 | 401 | 403 | 404 | 409 | 422 | 500> = {
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PLAN_LIMIT: 403,
  NOT_FOUND: 404,
  FILAMENT_NOT_FOUND: 404,
  SPOOL_NOT_FOUND: 404,
  INSUFFICIENT_FILAMENT: 409,
  CONFLICT: 409,
  INTERNAL: 500,
};

/** Error body sent by the server: `{ code, message, details? }`. `message` is technical (English). */
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** Business error thrown by use cases and turned into HTTP by the server's error middleware. */
export class BusinessError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  constructor(code: ErrorCode, message: string = code, details?: unknown) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
  }
  toBody(): ApiErrorBody {
    return this.details === undefined ? { code: this.code, message: this.message } : { code: this.code, message: this.message, details: this.details };
  }
}

export const isErrorCode = (x: unknown): x is ErrorCode => typeof x === 'string' && x in ErrorCode;
