"use strict";
// src/media.ts — Unsplash image search with deduplication (Vercel-adapted)
Object.defineProperty(exports, "__esModule", { value: true });
exports.findImage = findImage;
const logger_js_1 = require("./logger.js");
const utils_js_1 = require("./utils.js");
const storage_js_1 = require("./storage.js");
const UNSPLASH_BASE = 'https://api.unsplash.com';
const RESULTS_PER_PAGE = 10;
async function findImage(postText, unsplashAccessKey) {
    if (!unsplashAccessKey) {
        logger_js_1.logger.debug('Unsplash key not set, skipping image search');
        return undefined;
    }
    const keywords = (0, utils_js_1.extractKeywords)(postText, 3);
    const query = keywords.join(' ');
    const usedIds = (0, storage_js_1.getUsedImageIds)();
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
        logger_js_1.logger.warn('Unsplash network error, posting text-only', { error: err.message });
        return undefined;
    }
    if (!res.ok) {
        logger_js_1.logger.warn('Unsplash search failed, posting text-only', { status: res.status });
        return undefined;
    }
    const data = (await res.json());
    const unusedPhoto = data.results.find((photo) => !usedIds.has(photo.id));
    if (!unusedPhoto) {
        const fallbackKeyword = keywords[keywords.length - 1] ?? 'abstract';
        logger_js_1.logger.debug('All Unsplash results already used, trying fallback', { fallbackKeyword });
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
                    (0, storage_js_1.markImageUsed)(fallbackPhoto.id, fallbackPhoto.urls.regular);
                    logger_js_1.logger.info('Unsplash fallback image found', { keyword: fallbackKeyword, imageId: fallbackPhoto.id });
                    return fallbackPhoto.urls.regular;
                }
            }
        }
        catch {
            // silent fallback failure
        }
        logger_js_1.logger.debug('No unused Unsplash images available');
        return undefined;
    }
    (0, storage_js_1.markImageUsed)(unusedPhoto.id, unusedPhoto.urls.regular);
    logger_js_1.logger.info('Unsplash image found', { query, imageId: unusedPhoto.id });
    return unusedPhoto.urls.regular;
}
