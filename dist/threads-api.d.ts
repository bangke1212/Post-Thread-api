import type { AuthConfig } from './config.js';
export interface ThreadsPost {
    id: string;
    text?: string;
    timestamp?: string;
    username?: string;
}
export interface SearchResult {
    data: ThreadsPost[];
}
export interface MediaContainerResult {
    id: string;
}
export interface ShortLivedTokenResponse {
    access_token: string;
    user_id: string;
    token_type?: string;
    expires_in?: number;
}
export interface LongLivedTokenResponse {
    access_token: string;
    token_type?: string;
    expires_in: number;
}
export interface ThreadsProfile {
    id: string;
    username?: string;
    name?: string;
}
export declare class ThreadsClient {
    private readonly config;
    private resolvedThreadsUserId?;
    constructor(config: AuthConfig);
    getAccessToken(): string;
    private resolveThreadsUserId;
    private withAuthRetry;
    buildAuthUrl(state: string): string;
    exchangeCode(code: string): Promise<ShortLivedTokenResponse>;
    getLongLivedToken(shortLivedToken: string, userId?: string): Promise<LongLivedTokenResponse>;
    refreshToken(): Promise<void>;
    getCurrentUserProfile(accessToken?: string): Promise<ThreadsProfile>;
    maybeRefreshToken(): Promise<void>;
    keywordSearch(query: string, limit?: number): Promise<ThreadsPost[]>;
    createMediaContainer(text: string, imageUrl?: string): Promise<string>;
    publishMediaContainer(containerId: string): Promise<string>;
}
//# sourceMappingURL=threads-api.d.ts.map