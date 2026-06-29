export interface Post {
    id: number;
    source_query: string | null;
    source_post_ids: string | null;
    generated_text: string;
    threads_post_id: string | null;
    published_at: string | null;
}
export interface Token {
    id: number;
    access_token: string;
    refreshed_at: string;
    expires_at: string;
    user_id: string | null;
}
export interface Run {
    id: number;
    status: 'success' | 'failed';
    error_message: string | null;
    started_at: string;
    completed_at: string | null;
}
export declare function saveToken(secret: string, accessToken: string, expiresAt: Date, userId?: string): void;
export declare function updateTokenUserId(userId: string): void;
export declare function loadToken(secret: string): Token | undefined;
export declare function savePostRecord(post: Omit<Post, 'id'>): number;
export declare function getRecentPosts(limit?: number): Post[];
export declare function startRunRecord(): number;
export declare function completeRunRecord(runId: number, status: 'success' | 'failed', errorMessage?: string): void;
export declare function countRecentFailures(last?: number): number;
export declare function getUsedImageIds(): Set<string>;
export declare function markImageUsed(imageId: string, imageUrl: string): void;
export declare function resetStorage(): void;
//# sourceMappingURL=storage.d.ts.map