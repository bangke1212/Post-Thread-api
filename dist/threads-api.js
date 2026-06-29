// src/threads-api.ts — Threads Graph API client (Vercel-adapted)
import { AuthError, RateLimitError, TransientError } from './errors.js';
import { logger } from './logger.js';
import { loadToken, saveToken, updateTokenUserId } from './storage.js';
const BASE_URL = 'https://graph.threads.net/v1.0';
const AUTH_BASE = 'https://threads.net/oauth';
const OAUTH_API_BASE = 'https://graph.threads.net/oauth';
const TOKEN_BASE = 'https://graph.threads.net';
const USER_ID_PATTERN = /^\d+$/;
async function apiFetch(url, opts = {}) {
    let res;
    try {
        res = await fetch(url, opts);
    }
    catch (err) {
        throw new TransientError('Network error: ' + err.message);
    }
    if (res.status === 401)
        throw new AuthError();
    if (res.status === 429)
        throw new RateLimitError();
    if (res.status >= 500) {
        throw new TransientError('Threads API server error ' + res.status, res.status);
    }
    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(errorBody ? 'Threads API error ' + res.status + ': ' + errorBody : 'Threads API error ' + res.status);
    }
    return res.json();
}
export class ThreadsClient {
    config;
    resolvedThreadsUserId;
    constructor(config) {
        this.config = config;
    }
    getAccessToken() {
        const token = loadToken(this.config.threadsAppSecret);
        if (token)
            return token.access_token;
        if (this.config.threadsAccessToken)
            return this.config.threadsAccessToken;
        throw new AuthError('No access token found — run auth first');
    }
    async resolveThreadsUserId() {
        if (this.config.threadsUserId && USER_ID_PATTERN.test(this.config.threadsUserId)) {
            return this.config.threadsUserId;
        }
        if (this.resolvedThreadsUserId)
            return this.resolvedThreadsUserId;
        const profile = await this.getCurrentUserProfile();
        this.resolvedThreadsUserId = profile.id;
        const token = loadToken(this.config.threadsAppSecret);
        if (token && token.user_id !== profile.id) {
            updateTokenUserId(profile.id);
            logger.info('Repaired stored Threads user ID', { userId: profile.id });
        }
        return profile.id;
    }
    async withAuthRetry(request) {
        try {
            return await request();
        }
        catch (error) {
            if (!(error instanceof AuthError))
                throw error;
            logger.warn('Threads token rejected, attempting refresh');
            await this.refreshToken();
            return request();
        }
    }
    buildAuthUrl(state) {
        const params = new URLSearchParams({
            client_id: this.config.threadsAppId,
            redirect_uri: this.config.threadsRedirectUri,
            scope: 'threads_basic,threads_content_publish,threads_keyword_search',
            response_type: 'code',
            state,
        });
        return AUTH_BASE + '/authorize?' + params.toString();
    }
    async exchangeCode(code) {
        const body = new URLSearchParams({
            client_id: this.config.threadsAppId,
            client_secret: this.config.threadsAppSecret,
            grant_type: 'authorization_code',
            redirect_uri: this.config.threadsRedirectUri,
            code,
        });
        const result = await apiFetch(OAUTH_API_BASE + '/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        const userId = (await this.getCurrentUserProfile(result.access_token)).id;
        logger.info('Exchanged code for short-lived token', { userId });
        return {
            access_token: result.access_token,
            user_id: userId,
            token_type: result.token_type,
            expires_in: result.expires_in,
        };
    }
    async getLongLivedToken(shortLivedToken, userId) {
        const params = new URLSearchParams({
            grant_type: 'th_exchange_token',
            client_secret: this.config.threadsAppSecret,
            access_token: shortLivedToken,
        });
        const result = await apiFetch(TOKEN_BASE + '/access_token?' + params.toString(), { method: 'GET' });
        const expiresAt = new Date(Date.now() + result.expires_in * 1000);
        saveToken(this.config.threadsAppSecret, result.access_token, expiresAt, userId);
        logger.info('Long-lived token obtained', { expiresAt: expiresAt.toISOString() });
        return result;
    }
    async refreshToken() {
        const currentToken = this.getAccessToken();
        const params = new URLSearchParams({
            grant_type: 'th_refresh_token',
            access_token: currentToken,
        });
        const result = await apiFetch(TOKEN_BASE + '/refresh_access_token?' + params.toString(), { method: 'GET' });
        const expiresAt = new Date(Date.now() + result.expires_in * 1000);
        saveToken(this.config.threadsAppSecret, result.access_token, expiresAt);
        logger.info('Token refreshed', { expiresAt: expiresAt.toISOString() });
    }
    async getCurrentUserProfile(accessToken = this.getAccessToken()) {
        const params = new URLSearchParams({ fields: 'id,username,name' });
        return apiFetch(BASE_URL + '/me?' + params.toString(), {
            headers: { Authorization: 'Bearer ' + accessToken },
        });
    }
    async maybeRefreshToken() {
        const token = loadToken(this.config.threadsAppSecret);
        if (!token)
            return;
        const expiresAt = new Date(token.expires_at);
        const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry < 0) {
            logger.error('Token expired', { expiresAt: token.expires_at });
            throw new AuthError('Token expired — run auth to re-authenticate');
        }
        if (daysUntilExpiry <= 10) {
            logger.info('Token nearing expiry, refreshing', { daysLeft: Math.round(daysUntilExpiry) });
            await this.refreshToken();
        }
    }
    async keywordSearch(query, limit = 25) {
        const params = new URLSearchParams({ q: query, search_type: 'TOP', limit: String(limit) });
        const result = await this.withAuthRetry(() => apiFetch(BASE_URL + '/keyword_search?' + params.toString(), {
            headers: { Authorization: 'Bearer ' + this.getAccessToken() },
        }));
        logger.debug('Keyword search', { query, count: result.data.length });
        return result.data;
    }
    async createMediaContainer(text, imageUrl) {
        const threadsUserId = await this.resolveThreadsUserId();
        const params = new URLSearchParams({ text });
        if (imageUrl) {
            params.set('image_url', imageUrl);
            params.set('media_type', 'IMAGE');
        }
        else {
            params.set('media_type', 'TEXT');
        }
        const result = await this.withAuthRetry(() => apiFetch(BASE_URL + '/' + threadsUserId + '/threads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Bearer ' + this.getAccessToken(),
            },
            body: params.toString(),
        }));
        logger.debug('Media container created', { containerId: result.id });
        return result.id;
    }
    async publishMediaContainer(containerId) {
        const threadsUserId = await this.resolveThreadsUserId();
        const params = new URLSearchParams({ creation_id: containerId });
        const result = await this.withAuthRetry(() => apiFetch(BASE_URL + '/' + threadsUserId + '/threads_publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Bearer ' + this.getAccessToken(),
            },
            body: params.toString(),
        }));
        logger.info('Post published', { postId: result.id });
        return result.id;
    }
}
//# sourceMappingURL=threads-api.js.map