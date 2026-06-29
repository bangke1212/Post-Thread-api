export interface Config {
    threadsAppId: string;
    threadsAppSecret: string;
    threadsUserId?: string;
    threadsAccessToken: string | undefined;
    threadsRedirectUri: string;
    dbPath: string;
    openrouterApiKey: string;
    openrouterModel: string;
    searchQueries: string[];
    /**
     * Themed query buckets used for day-of-week rotation. When CATEGORY_QUERIES is
     * unset, this is derived from searchQueries so existing flat-config deployments
     * keep working and gain rotation for free.
     */
    categoryQueries: Record<string, string[]>;
    minSourcePosts: number;
    minSourceQueries: number;
    maxSourcePostsPerQuery: number;
    postTimes: string[];
    timezone: string;
    unsplashAccessKey: string | undefined;
    dryRun: boolean;
}
export interface AuthConfig {
    threadsAppId: string;
    threadsAppSecret: string;
    threadsUserId?: string;
    threadsAccessToken: string | undefined;
    threadsRedirectUri: string;
    dbPath: string;
}
/**
 * Load only the env needed for Threads auth/bootstrap.
 */
export declare function getAuthConfig(): AuthConfig;
/**
 * Load and validate config from environment variables.
 * Cached after first call.
 */
export declare function getConfig(): Config;
/**
 * Override config (used in tests).
 */
export declare function setConfig(cfg: Config): void;
export declare function clearConfig(): void;
//# sourceMappingURL=config.d.ts.map