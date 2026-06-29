/**
 * Pick `count` random unique items from an array without mutating it.
 */
export declare function pickRandom<T>(arr: readonly T[], count: number): T[];
/**
 * Deduplicate an array of objects by a string key.
 */
export declare function dedupeBy<T>(items: T[], key: keyof T): T[];
/**
 * Parse a "HH:MM" string into { hour, minute } for cron.
 */
export declare function parseTime(hhmm: string): {
    hour: number;
    minute: number;
};
/**
 * Build a cron expression for a given hour/minute.
 * e.g. { hour: 9, minute: 0 } → "0 9 * * *"
 */
export declare function toCronExpr(hour: number, minute: number): string;
/**
 * Extract the first word that looks like a meaningful keyword from text.
 * Used to query Unsplash when no explicit keyword is provided.
 */
export declare function extractKeyword(text: string): string;
/**
 * Extract multiple meaningful keywords from text for better image search variety.
 * Returns up to `count` unique keywords, skipping stopwords and short words.
 */
export declare function extractKeywords(text: string, count?: number): string[];
/**
 * Sleep for ms milliseconds.
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Truncate at the last sentence boundary within maxLen.
 * Falls back to last word boundary if no sentence fits.
 */
export declare function truncate(text: string, maxLen: number): string;
/**
 * Drop any sentence that references the author's employer or day job.
 * Splits on sentence boundaries (. ! ? newline), removes matching sentences, rejoins.
 * A partial inline edit would leave broken fragments, so the whole sentence goes.
 */
export declare function stripEmployerSentences(text: string): string;
/**
 * Strip AI-generated artifacts from post text.
 * Removes em dashes, clause-level colons, employer references, normalizes whitespace.
 */
export declare function sanitizePost(text: string): string;
//# sourceMappingURL=utils.d.ts.map