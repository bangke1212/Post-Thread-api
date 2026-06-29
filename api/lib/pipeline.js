"use strict";
// src/pipeline.ts — Crawl → Craft → Publish orchestration (Vercel-adapted)
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayOfWeekInTimezone = dayOfWeekInTimezone;
exports.buildDailyQueryPool = buildDailyQueryPool;
exports.buildCrawlQueryPool = buildCrawlQueryPool;
exports.collectSourcePosts = collectSourcePosts;
exports.buildBalancedSourcePosts = buildBalancedSourcePosts;
exports.fitPostToLimit = fitPostToLimit;
exports.runPipeline = runPipeline;
const errors_js_1 = require("./errors.js");
const logger_js_1 = require("./logger.js");
const retry_js_1 = require("./retry.js");
const storage_js_1 = require("./storage.js");
const threads_api_js_1 = require("./threads-api.js");
const openrouter_js_1 = require("./openrouter.js");
const prompt_js_1 = require("./prompt.js");
const media_js_1 = require("./media.js");
const utils_js_1 = require("./utils.js");
const MAX_POST_CHARS = 450;
const TARGET_POST_CHARS = 350;
const POSTS_PER_QUERY = 25;
const MAX_COMPRESSION_ATTEMPTS = 2;
const TREND_FIRST_FALLBACK_SEARCH_QUERIES = [
    'trending', 'viral', 'lagi rame', 'ramai', 'Indonesia', 'Jakarta',
    'startup', 'bisnis', 'career', 'creator', 'marketing', 'web3',
    'crypto', 'developer', 'tech', 'productivity',
];
const AI_FALLBACK_SEARCH_QUERIES = ['AI', 'ChatGPT', 'OpenAI'];
const AI_QUERY_PATTERN = /\b(ai|artificial intelligence|chatgpt|openai|claude|gemini|llm|agent)\b/i;
let runInProgress = false;
function dayOfWeekInTimezone(date, timezone) {
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
    }).format(date);
    const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const index = order.indexOf(weekday);
    return index === -1 ? 0 : index;
}
function buildDailyQueryPool(catalog, date, timezone) {
    const bucketKeys = Object.keys(catalog).sort();
    if (bucketKeys.length === 0)
        return [];
    const dayOfWeek = dayOfWeekInTimezone(date, timezone);
    const flattened = [];
    for (const key of bucketKeys) {
        for (const query of catalog[key] ?? []) {
            flattened.push(query);
        }
    }
    if (flattened.length > 1) {
        const shift = dayOfWeek % flattened.length;
        flattened.push(...flattened.splice(0, shift));
    }
    return buildCrawlQueryPool(flattened, false);
}
function buildCrawlQueryPool(searchQueries, shuffle = true) {
    const uniqueQueries = new Set();
    const uniqueDeferredAiQueries = new Set();
    const crawlQueries = [];
    const deferredAiQueries = [];
    const addQuery = (query, target) => {
        const normalized = query.trim();
        const key = normalized.toLowerCase();
        if (!normalized || uniqueQueries.has(key))
            return;
        uniqueQueries.add(key);
        target.push(normalized);
    };
    const deferAiQuery = (query) => {
        const normalized = query.trim();
        const key = normalized.toLowerCase();
        if (!normalized || uniqueQueries.has(key) || uniqueDeferredAiQueries.has(key))
            return;
        uniqueDeferredAiQueries.add(key);
        deferredAiQueries.push(normalized);
    };
    const orderedQueries = shuffle ? (0, utils_js_1.pickRandom)(searchQueries, searchQueries.length) : searchQueries;
    for (const query of [...orderedQueries, ...TREND_FIRST_FALLBACK_SEARCH_QUERIES]) {
        const normalized = query.trim();
        if (!normalized)
            continue;
        if (AI_QUERY_PATTERN.test(normalized)) {
            deferAiQuery(normalized);
            continue;
        }
        addQuery(normalized, crawlQueries);
    }
    for (const query of deferredAiQueries) {
        addQuery(query, crawlQueries);
    }
    if (crawlQueries.length === 0) {
        for (const query of AI_FALLBACK_SEARCH_QUERIES) {
            addQuery(query, crawlQueries);
        }
    }
    return crawlQueries;
}
async function collectSourcePosts(searchQueries, minSourcePosts, minSourceQueries, searchFn, crawlQueries = buildCrawlQueryPool(searchQueries)) {
    const usedQueries = [];
    const successfulQueries = [];
    const queryResults = [];
    let allPosts = [];
    for (const query of crawlQueries) {
        if (allPosts.length >= minSourcePosts && successfulQueries.length >= minSourceQueries)
            break;
        const posts = await searchFn(query, POSTS_PER_QUERY);
        usedQueries.push(query);
        const existingIds = new Set(allPosts.map((post) => post.id));
        const uniqueAddedPosts = posts.filter((post) => !existingIds.has(post.id));
        allPosts = (0, utils_js_1.dedupeBy)(allPosts.concat(posts), 'id');
        if (uniqueAddedPosts.length > 0)
            successfulQueries.push(query);
        queryResults.push({ query, fetchedPosts: posts.length, uniqueAddedPosts });
        logger_js_1.logger.info('Crawl query complete', {
            query,
            fetchedPosts: posts.length,
            uniqueAddedPosts: uniqueAddedPosts.length,
            uniquePosts: allPosts.length,
        });
    }
    return { posts: allPosts, usedQueries, successfulQueries, queryResults };
}
function buildBalancedSourcePosts(queryResults, maxSourcePostsPerQuery, maxTotalPosts = 30) {
    const perQueryQueues = queryResults
        .map((result) => result.uniqueAddedPosts.slice(0, maxSourcePostsPerQuery))
        .filter((posts) => posts.length > 0)
        .map((posts) => [...posts]);
    const balancedPosts = [];
    while (balancedPosts.length < maxTotalPosts) {
        let pushedInRound = false;
        for (const queue of perQueryQueues) {
            const nextPost = queue.shift();
            if (!nextPost)
                continue;
            balancedPosts.push(nextPost);
            pushedInRound = true;
            if (balancedPosts.length >= maxTotalPosts)
                break;
        }
        if (!pushedInRound)
            break;
    }
    return balancedPosts;
}
async function fitPostToLimit(text, rewriteFn, maxChars = MAX_POST_CHARS, targetChars = TARGET_POST_CHARS, maxAttempts = MAX_COMPRESSION_ATTEMPTS) {
    let candidate = text.trim();
    if (candidate.length <= maxChars)
        return candidate;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        logger_js_1.logger.warn('Generated post exceeded length limit, rewriting', {
            attempt, currentLength: candidate.length,
        });
        candidate = (await rewriteFn(candidate, targetChars)).trim();
        if (candidate.length <= maxChars)
            return candidate;
    }
    logger_js_1.logger.warn('Falling back to truncation after rewrite attempts', {
        finalLength: candidate.length,
    });
    return (0, utils_js_1.truncate)(candidate, maxChars);
}
async function runPipeline(config, dryRun = false) {
    if (runInProgress) {
        logger_js_1.logger.warn('Pipeline already running, skipping');
        throw new errors_js_1.RunLockError();
    }
    runInProgress = true;
    const runId = (0, storage_js_1.startRunRecord)();
    const effectiveDryRun = dryRun || config.dryRun;
    logger_js_1.logger.info('Pipeline started', { runId, dryRun: effectiveDryRun });
    try {
        const threadsClient = new threads_api_js_1.ThreadsClient(config);
        const openRouterClient = new openrouter_js_1.OpenRouterClient(config);
        // ── Pre-flight: check/refresh token ───────────────────────────────────
        await (0, retry_js_1.withRetry)(() => threadsClient.maybeRefreshToken());
        // ── Stage 1: Crawl ────────────────────────────────────────────────────
        logger_js_1.logger.info('Crawl stage', {
            configuredQueries: config.searchQueries,
            categoryBuckets: Object.keys(config.categoryQueries),
            dayOfWeek: dayOfWeekInTimezone(new Date(), config.timezone),
        });
        const dailyQueryPool = buildDailyQueryPool(config.categoryQueries, new Date(), config.timezone);
        const { posts: allPosts, usedQueries, successfulQueries, queryResults } = await collectSourcePosts(config.searchQueries, config.minSourcePosts, config.minSourceQueries, (query, limit) => (0, retry_js_1.withRetry)(() => threadsClient.keywordSearch(query, limit)), dailyQueryPool);
        logger_js_1.logger.info('Crawl complete', {
            totalPosts: allPosts.length,
            usedQueries,
            successfulQueries,
        });
        if (allPosts.length < config.minSourcePosts || successfulQueries.length < config.minSourceQueries) {
            const message = `Insufficient source coverage: found ${allPosts.length}/${config.minSourcePosts} posts ` +
                `across ${successfulQueries.length}/${config.minSourceQueries} successful queries. ` +
                'Broaden SEARCH_QUERIES or lower MIN_SOURCE_POSTS / MIN_SOURCE_QUERIES.';
            logger_js_1.logger.warn('Skipping craft stage due to thin crawl', { totalPosts: allPosts.length });
            (0, storage_js_1.completeRunRecord)(runId, 'failed', message);
            return { status: 'skipped', error: message };
        }
        // ── Stage 2: Craft ────────────────────────────────────────────────────
        const recentPosts = (0, storage_js_1.getRecentPosts)(10);
        const promptSourcePosts = buildBalancedSourcePosts(queryResults, config.maxSourcePostsPerQuery);
        const [systemPrompt, userMessage] = (0, prompt_js_1.buildMessages)(promptSourcePosts, recentPosts, successfulQueries, {
            timezone: config.timezone,
        });
        logger_js_1.logger.info('Craft stage', {
            sourcePosts: promptSourcePosts.length,
            recentPosts: recentPosts.length,
            successfulQueries,
        });
        const generatedText = await (0, retry_js_1.withRetry)(() => openRouterClient.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ]));
        const fittedText = await fitPostToLimit(generatedText, (text, targetChars) => (0, retry_js_1.withRetry)(() => openRouterClient.chat([
            {
                role: 'system',
                content: 'You are an expert social editor. Rewrite the Threads post below in natural Bahasa Indonesia. ' +
                    `Make it SHORTER and PUNCHIER, fit under ${targetChars} characters. ` +
                    'Pick the single strongest angle and cut everything else. ' +
                    'No em dashes, no colons, no hashtags, no emojis unless essential, no filler. ' +
                    'Return ONLY the rewritten post text.',
            },
            { role: 'user', content: text },
        ], 400)));
        const safeText = (0, utils_js_1.sanitizePost)(fittedText);
        logger_js_1.logger.info('Post crafted', { length: safeText.length });
        // ── Stage 3: Publish ──────────────────────────────────────────────────
        if (effectiveDryRun) {
            logger_js_1.logger.info('DRY RUN — would publish generated post', { length: safeText.length });
            (0, storage_js_1.savePostRecord)({
                source_query: successfulQueries.join(','),
                source_post_ids: JSON.stringify(allPosts.slice(0, 10).map((p) => p.id)),
                generated_text: safeText,
                threads_post_id: null,
                published_at: null,
            });
            (0, storage_js_1.completeRunRecord)(runId, 'success');
            return { status: 'success', generatedText: safeText };
        }
        const imageUrl = await (0, media_js_1.findImage)(safeText, config.unsplashAccessKey);
        const containerId = await (0, retry_js_1.withRetry)(() => threadsClient.createMediaContainer(safeText, imageUrl));
        await new Promise((r) => setTimeout(r, 1500));
        const publishedId = await (0, retry_js_1.withRetry)(() => threadsClient.publishMediaContainer(containerId));
        (0, storage_js_1.savePostRecord)({
            source_query: successfulQueries.join(','),
            source_post_ids: JSON.stringify(allPosts.slice(0, 10).map((p) => p.id)),
            generated_text: safeText,
            threads_post_id: publishedId,
            published_at: new Date().toISOString(),
        });
        (0, storage_js_1.completeRunRecord)(runId, 'success');
        const consecutiveFailures = (0, storage_js_1.countRecentFailures)(3);
        if (consecutiveFailures >= 3) {
            logger_js_1.logger.warn('3 consecutive failed runs detected');
        }
        logger_js_1.logger.info('Pipeline completed successfully', { postId: publishedId });
        return { status: 'success', postId: publishedId, generatedText: safeText };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof errors_js_1.RateLimitError) {
            logger_js_1.logger.warn('Rate limited — skipping run', { error: message });
            (0, storage_js_1.completeRunRecord)(runId, 'failed', message);
            return { status: 'skipped', error: message };
        }
        if (err instanceof errors_js_1.AuthError) {
            logger_js_1.logger.error('Auth error in pipeline — token refresh failed', { error: message });
            (0, storage_js_1.completeRunRecord)(runId, 'failed', message);
            return { status: 'failed', error: message };
        }
        logger_js_1.logger.error('Pipeline failed', { error: message });
        (0, storage_js_1.completeRunRecord)(runId, 'failed', message);
        return { status: 'failed', error: message };
    }
    finally {
        runInProgress = false;
    }
}
