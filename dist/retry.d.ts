export interface RetryOptions {
    maxAttempts: number;
    baseDelayMs: number;
    /** Do not retry these error types (re-throw immediately) */
    noRetry?: Array<new (...args: never[]) => Error>;
}
/**
 * Retry fn up to maxAttempts times on TransientError (or any generic Error
 * not in the noRetry list).  AuthError and RateLimitError are never retried.
 */
export declare function withRetry<T>(fn: () => Promise<T>, opts?: Partial<RetryOptions>): Promise<T>;
//# sourceMappingURL=retry.d.ts.map