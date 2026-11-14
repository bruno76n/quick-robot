// Error and warning catalog (docs/12 §2). Codes are stable: never change or reuse a published one.

export const ERRORS = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PLAN_LIMIT: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_IMAGE: 415,
  RATE_LIMITED: 429,
  STORAGE_FULL: 507,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  RESTORE_CONFLICT: 409,
  PRODUCT_IN_ACTIVE_ORDERS: 409,
  PRODUCT_HAS_STOCK: 409,
  PRODUCT_HAS_VARIANTS: 409,
  STOCK_TRACKING_HAS_STOCK: 409,
  COLLECTION_EMPTY: 422,
  NO_PRODUCTS: 409,
  LINE_ITEMS_REQUIRED: 422,
  CUSTOMER_REQUIRED: 422,
  INSUFFICIENT_STOCK: 409,
  PAYMENT_EXCEEDS_BALANCE: 422,
  REFUND_EXCEEDS_PAID: 422,
  SALE_ALREADY_RETURNED: 409,
  ORDER_INVALID_STATE: 409,
  ORDER_NOT_ACTIVE: 409,
  PRINTER_ASSIGNMENT_REQUIRED: 422,
  NO_PRINTERS: 409,
  CUSTOMER_NAME_EXISTS: 409,
  CUSTOMER_HAS_HISTORY: 409,
  CHANNEL_NAME_EXISTS: 409,
  CHANNEL_IN_USE: 409,
  LAST_CHANNEL: 409,
  NO_SPOOL_FOR_FILAMENT: 409,
  NO_SPOOLS: 409,
  SPOOL_INSUFFICIENT: 422,
  SPOOL_NOT_IN_FILAMENT: 422,
  SPOOL_ALREADY_EMPTY: 409,
  WEIGHT_OUT_OF_RANGE: 422,
  REFERENCE_COST_REQUIRED: 422,
  SUPPLY_NAME_EXISTS: 409,
  SUPPLY_IN_USE: 409,
  SUPPLY_INSUFFICIENT: 422,
  COUNT_UNCHANGED: 422,
  PRINTER_HAS_QUEUE: 409,
  PRINT_RUN_LOCKED: 409,
  CONFIRMATION_REQUIRED: 422,
  IMPORT_INVALID_FILE: 422,
  IMPORT_UNSUPPORTED_VERSION: 422,
} as const;

/** Reserved for phase 5 (docs/12 §2); defined in 16. */
export const RESERVED_ERRORS = ['INVALID_CREDENTIALS', 'EMAIL_TAKEN', 'TOKEN_EXPIRED', 'ACCOUNT_LOCKED', 'SUBSCRIPTION_INACTIVE'] as const;

export const WARNINGS = ['STOCK_SHORT', 'FILAMENT_SHORTFALL', 'ORDER_WAITING_OTHER_PRINTERS', 'PRODUCTS_MISSING', 'FILAMENT_NOT_RETURNED'] as const;

/** `details` fields of each code (docs/12 §2); the interface builds its Spanish text from them (docs/13). */
export const ERROR_DETAILS: Record<ErrorCode, readonly string[]> = {
  VALIDATION_ERROR: ['fields'], UNAUTHENTICATED: [], FORBIDDEN: ['capability'], PLAN_LIMIT: ['capability', 'limit'],
  NOT_FOUND: ['entity'], PAYLOAD_TOO_LARGE: ['maxBytes'], FILE_TOO_LARGE: ['maxMb'], UNSUPPORTED_IMAGE: ['accepted'],
  RATE_LIMITED: ['retryAfterSec'], STORAGE_FULL: [], INTERNAL_ERROR: ['errorId'], SERVICE_UNAVAILABLE: [],
  RESTORE_CONFLICT: ['entity', 'reason'], PRODUCT_IN_ACTIVE_ORDERS: ['count', 'folios'], PRODUCT_HAS_STOCK: ['onHand'], PRODUCT_HAS_VARIANTS: ['count'],
  STOCK_TRACKING_HAS_STOCK: ['onHand'], COLLECTION_EMPTY: [], NO_PRODUCTS: [], LINE_ITEMS_REQUIRED: [], CUSTOMER_REQUIRED: [],
  INSUFFICIENT_STOCK: ['items', 'productId', 'name', 'requested', 'free'], PAYMENT_EXCEEDS_BALANCE: ['balanceCents'],
  REFUND_EXCEEDS_PAID: ['paidCents'], SALE_ALREADY_RETURNED: [], ORDER_INVALID_STATE: ['status', 'expected'],
  ORDER_NOT_ACTIVE: ['status'], PRINTER_ASSIGNMENT_REQUIRED: ['count', 'lineItemIds'], NO_PRINTERS: [],
  CUSTOMER_NAME_EXISTS: ['name'], CUSTOMER_HAS_HISTORY: ['orders', 'sales'], CHANNEL_NAME_EXISTS: ['name'],
  CHANNEL_IN_USE: ['name', 'sales', 'orders'], LAST_CHANNEL: [], NO_SPOOL_FOR_FILAMENT: [], NO_SPOOLS: [],
  SPOOL_INSUFFICIENT: ['availableGrams'], SPOOL_NOT_IN_FILAMENT: ['spoolId'], SPOOL_ALREADY_EMPTY: [], WEIGHT_OUT_OF_RANGE: ['maxGrams'],
  REFERENCE_COST_REQUIRED: [], SUPPLY_NAME_EXISTS: ['name'], SUPPLY_IN_USE: ['products'],
  SUPPLY_INSUFFICIENT: ['available'], COUNT_UNCHANGED: [], PRINTER_HAS_QUEUE: ['name', 'jobs'],
  PRINT_RUN_LOCKED: ['reason', 'pieces'], CONFIRMATION_REQUIRED: [], IMPORT_INVALID_FILE: ['reason'],
  IMPORT_UNSUPPORTED_VERSION: ['found', 'supported'],
};

export const WARNING_DETAILS: Record<WarningCode, readonly string[]> = {
  STOCK_SHORT: ['missing'],
  FILAMENT_SHORTFALL: ['items', 'filamentId', 'name', 'missingGrams'],
  ORDER_WAITING_OTHER_PRINTERS: ['orderNumber', 'printerNames'],
  PRODUCTS_MISSING: ['count'],
  FILAMENT_NOT_RETURNED: [],
};

export type ErrorCode = keyof typeof ERRORS;
export type WarningCode = (typeof WARNINGS)[number];

export interface FieldError {
  path: string;
  rule: 'required' | 'too_long' | 'too_small' | 'too_big' | 'not_integer' | 'invalid_format' | 'invalid_date' | 'invalid_email' | string;
  params?: Record<string, number | string>;
}

export interface Warning { code: WarningCode; details?: Record<string, unknown> }
export interface ErrorBody { code: ErrorCode; message: string; details?: Record<string, unknown>; errorId?: string }

export function httpStatus(code: ErrorCode): number {
  return ERRORS[code];
}

/** A business rule said no. Thrown by use cases; the error middleware turns it into `{ code, message, details }`. */
export class BusinessError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;
  constructor(code: ErrorCode, details?: Record<string, unknown>, message?: string) {
    super(message ?? code);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
  }
  get status(): number {
    return httpStatus(this.code);
  }
}
