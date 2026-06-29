// api/auth.ts — OAuth auth endpoint for Vercel
// GET /api/auth — starts OAuth flow, redirects to Threads
// GET /api/auth?code=... — handles OAuth callback

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { getAuthConfig } from '../src/config.js';
import { ThreadsClient } from '../src/threads-api.js';
import { logger } from '../src/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query['code'];
  const state = req.query['state'];

  // If code is present, this is the OAuth callback
  if (code && typeof code === 'string') {
    return handleCallback(code, typeof state === 'string' ? state : undefined, res);
  }

  // Otherwise, start OAuth flow
  return startAuth(res);
}

async function startAuth(res: VercelResponse) {
  const config = getAuthConfig();
  const client = new ThreadsClient(config);

  const expectedState = randomBytes(24).toString('hex');
  const authUrl = client.buildAuthUrl(expectedState);

  // Store state in a cookie for verification (short-lived)
  res.setHeader('Set-Cookie', 'oauth_state=' + expectedState + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=600');

  // Redirect user to Threads OAuth page
  return res.redirect(authUrl);
}

async function handleCallback(code: string, state: string | undefined, res: VercelResponse) {
  try {
    const config = getAuthConfig();
    const client = new ThreadsClient(config);

    logger.info('Exchanging OAuth code for token...');

    const shortLived = await client.exchangeCode(code);
    const longLived = await client.getLongLivedToken(shortLived.access_token, shortLived.user_id);

    logger.info('Auth successful', {
      userId: shortLived.user_id,
      expiresInDays: Math.round(longLived.expires_in / 86400),
    });

    return res.status(200).json({
      success: true,
      message: 'Authentication successful! Bot is ready to use.',
      userId: shortLived.user_id,
      expiresInDays: Math.round(longLived.expires_in / 86400),
    });
  } catch (err) {
    logger.error('Auth callback failed', { error: (err as Error).message });
    return res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
}
