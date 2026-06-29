// src/media.ts — Unsplash image search with deduplication (Vercel-adapted)
import { logger } from './logger.js';
import { extractKeywords } from './utils.js';
import { getUsedImageIds, markImageUsed } from './storage.js';
const UNSPLASH_BASE = 'https://api.unsplash.com';
const RESULTS_PER_PAGE = 10;
export async function findImage(postText, unsplashAccessKey) {
    if (!unsplashAccessKey) {
        logger.debug('Unsplash key not set, skipping image search');
        return undefined;
    }
    const keywords = extractKeywords(postText, 3);
    const query = keywords.join(' ');
    const usedIds = getUsedImageIds();
    const url = UNSPLASH_BASE + '/search/photos?query=' + encodeURIComponent(query) + '&per_page=' + RESULTS_PER_PAGE + '&orientation=landscape';
    let res;
    try {
        res = await fetch(url, {
            headers: {
                Authorization: 'Client-ID ' + unsplashAccessKey,
                'Accept-Version': 'v1',
            },
        });
    }
    catch (err) {
        logger.warn('Unsplash network error, posting text-only', { error: err.message });
        return undefined;
    }
    if (!res.ok) {
        logger.warn('Unsplash search failed, posting text-only', { status: res.status });
        return undefined;
    }
    const data = (await res.json());
    const unusedPhoto = data.results.find((photo) => !usedIds.has(photo.id));
    if (!unusedPhoto) {
        const fallbackKeyword = keywords[keywords.length - 1] ?? 'abstract';
        logger.debug('All Unsplash results already used, trying fallback', { fallbackKeyword });
        const fallbackUrl = UNSPLASH_BASE + '/search/photos?query=' + encodeURIComponent(fallbackKeyword) + '&per_page=' + RESULTS_PER_PAGE + '&orientation=landscape&page=2';
        try {
            const fallbackRes = await fetch(fallbackUrl, {
                headers: {
                    Authorization: 'Client-ID ' + unsplashAccessKey,
                    'Accept-Version': 'v1',
                },
            });
            if (fallbackRes.ok) {
                const fallbackData = (await fallbackRes.json());
                const fallbackPhoto = fallbackData.results.find((photo) => !usedIds.has(photo.id));
                if (fallbackPhoto) {
                    markImageUsed(fallbackPhoto.id, fallbackPhoto.urls.regular);
                    logger.info('Unsplash fallback image found', { keyword: fallbackKeyword, imageId: fallbackPhoto.id });
                    return fallbackPhoto.urls.regular;
                }
            }
        }
        catch {
            // silent fallback failure
        }
        logger.debug('No unused Unsplash images available');
        return undefined;
    }
    markImageUsed(unusedPhoto.id, unusedPhoto.urls.regular);
    logger.info('Unsplash image found', { query, imageId: unusedPhoto.id });
    return unusedPhoto.urls.regular;
}
//# sourceMappingURL=media.js.map