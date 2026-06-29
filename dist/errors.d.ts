export declare class AppError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
/** HTTP 401 from Threads API — trigger token refresh */
export declare class AuthError extends AppError {
    constructor(message?: string);
}
/** HTTP 429 — rate limited; skip this run */
export declare class RateLimitError extends AppError {
    constructor(message?: string);
}
/** 5xx or network failure — eligible for retry */
export declare class TransientError extends AppError {
    readonly statusCode?: number | undefined;
    constructor(message: string, statusCode?: number | undefined);
}
/** Config is incomplete or invalid */
export declare class ConfigError extends AppError {
    constructor(message: string);
}
/** Token is fully expired; re-auth required */
export declare class TokenExpiredError extends AppError {
    constructor(message?: string);
}
/** Pipeline overlapping run detected */
export declare class RunLockError extends AppError {
    constructor(message?: string);
}
//# sourceMappingURL=errors.d.ts.map