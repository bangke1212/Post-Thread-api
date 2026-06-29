"use strict";
// src/errors.ts — typed error hierarchy
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunLockError = exports.TokenExpiredError = exports.ConfigError = exports.TransientError = exports.RateLimitError = exports.AuthError = exports.AppError = void 0;
class AppError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
/** HTTP 401 from Threads API — trigger token refresh */
class AuthError extends AppError {
    constructor(message = 'Authentication failed; token may be expired') {
        super(message, 'AUTH_ERROR');
    }
}
exports.AuthError = AuthError;
/** HTTP 429 — rate limited; skip this run */
class RateLimitError extends AppError {
    constructor(message = 'Rate limited by Threads API') {
        super(message, 'RATE_LIMIT');
    }
}
exports.RateLimitError = RateLimitError;
/** 5xx or network failure — eligible for retry */
class TransientError extends AppError {
    statusCode;
    constructor(message, statusCode) {
        super(message, 'TRANSIENT_ERROR');
        this.statusCode = statusCode;
    }
}
exports.TransientError = TransientError;
/** Config is incomplete or invalid */
class ConfigError extends AppError {
    constructor(message) {
        super(message, 'CONFIG_ERROR');
    }
}
exports.ConfigError = ConfigError;
/** Token is fully expired; re-auth required */
class TokenExpiredError extends AppError {
    constructor(message = 'Access token expired — run `auth` to re-authenticate') {
        super(message, 'TOKEN_EXPIRED');
    }
}
exports.TokenExpiredError = TokenExpiredError;
/** Pipeline overlapping run detected */
class RunLockError extends AppError {
    constructor(message = 'A pipeline run is already in progress') {
        super(message, 'RUN_LOCK');
    }
}
exports.RunLockError = RunLockError;
