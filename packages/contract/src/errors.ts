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
  INSUFFICIENT_SUPPLY: 'INSUFFICIENT_SUPPLY',
  NO_CHANGE: 'NO_CHANGE',
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  LAST_CHANNEL: 'LAST_CHANNEL',
  SUPPLY_IN_USE: 'SUPPLY_IN_USE',
  SUPPLIER_NOT_FOUND: 'SUPPLIER_NOT_FOUND',
  SUPPLY_NOT_FOUND: 'SUPPLY_NOT_FOUND',
  PRINTER_NOT_FOUND: 'PRINTER_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  COLLECTION_NOT_FOUND: 'COLLECTION_NOT_FOUND',
  PRODUCT_NEEDS_FILAMENT: 'PRODUCT_NEEDS_FILAMENT',
  PRODUCT_NEEDS_PRICE: 'PRODUCT_NEEDS_PRICE',
  COLLECTION_NEEDS_PART: 'COLLECTION_NEEDS_PART',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status for each code (docs/08 › Forma de la API). */
export const errorHttpStatus: Record<ErrorCode, 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500> = {
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PLAN_LIMIT: 403,
  NOT_FOUND: 404,
  FILAMENT_NOT_FOUND: 404,
  SPOOL_NOT_FOUND: 404,
  INSUFFICIENT_FILAMENT: 409,
  INSUFFICIENT_SUPPLY: 409,
  NO_CHANGE: 422,
  DUPLICATE_NAME: 409,
  LAST_CHANNEL: 409,
  SUPPLY_IN_USE: 409,
  SUPPLIER_NOT_FOUND: 404,
  SUPPLY_NOT_FOUND: 404,
  PRINTER_NOT_FOUND: 404,
  TASK_NOT_FOUND: 404,
  CHANNEL_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  COLLECTION_NOT_FOUND: 404,
  PRODUCT_NEEDS_FILAMENT: 422,
  PRODUCT_NEEDS_PRICE: 422,
  COLLECTION_NEEDS_PART: 422,
  UNSUPPORTED_FILE: 415,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
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
