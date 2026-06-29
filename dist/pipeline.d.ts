import type { Config } from './config.js';
import type { ThreadsPost } from './threads-api.js';
export interface PipelineResult {
    status: 'success' | 'failed' | 'skipped';
    postId?: string;
    generatedText?: string;
    error?: string;
}
export interface QueryCrawlResult {
    query: string;
    fetchedPosts: number;
    uniqueAddedPosts: ThreadsPost[];
}
export declare function dayOfWeekInTimezone(date: Date, timezone: string): number;
export declare function buildDailyQueryPool(catalog: Record<string, string[]>, date: Date, timezone: string): string[];
export declare function buildCrawlQueryPool(searchQueries: string[], shuffle?: boolean): string[];
export declare function collectSourcePosts(searchQueries: string[], minSourcePosts: number, minSourceQueries: number, searchFn: (query: string, limit: number) => Promise<ThreadsPost[]>, crawlQueries?: string[]): Promise<{
    posts: ThreadsPost[];
    usedQueries: string[];
    successfulQueries: string[];
    queryResults: QueryCrawlResult[];
}>;
export declare function buildBalancedSourcePosts(queryResults: QueryCrawlResult[], maxSourcePostsPerQuery: number, maxTotalPosts?: number): ThreadsPost[];
export declare function fitPostToLimit(text: string, rewriteFn: (text: string, targetChars: number) => Promise<string>, maxChars?: number, targetChars?: number, maxAttempts?: number): Promise<string>;
export declare function runPipeline(config: Config, dryRun?: boolean): Promise<PipelineResult>;
//# sourceMappingURL=pipeline.d.ts.map