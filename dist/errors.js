// src/errors.ts — typed error hierarchy
export class AppError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
/** HTTP 401 from Threads API — trigger token refresh */
export class AuthError extends AppError {
    constructor(message = 'Authentication failed; token may be expired') {
        super(message, 'AUTH_ERROR');
    }
}
/** HTTP 429 — rate limited; skip this run */
export class RateLimitError extends AppError {
    constructor(message = 'Rate limited by Threads API') {
        super(message, 'RATE_LIMIT');
    }
}
/** 5xx or network failure — eligible for retry */
export class TransientError extends AppError {
    statusCode;
    constructor(message, statusCode) {
        super(message, 'TRANSIENT_ERROR');
        this.statusCode = statusCode;
    }
}
/** Config is incomplete or invalid */
export class ConfigError extends AppError {
    constructor(message) {
        super(message, 'CONFIG_ERROR');
    }
}
/** Token is fully expired; re-auth required */
export class TokenExpiredError extends AppError {
    constructor(message = 'Access token expired — run `auth` to re-authenticate') {
        super(message, 'TOKEN_EXPIRED');
    }
}
/** Pipeline overlapping run detected */
export class RunLockError extends AppError {
    constructor(message = 'A pipeline run is already in progress') {
        super(message, 'RUN_LOCK');
    }
}
//# sourceMappingURL=errors.js.map