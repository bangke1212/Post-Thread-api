// api/auth.js — OAuth auth endpoint for Vercel

import { randomBytes } from 'crypto';
import { getAuthConfig } from '../dist/config.js';
import { ThreadsClient } from '../dist/threads-api.js';
import { logger } from '../dist/logger.js';

export default async function handler(req, res) {
  const code = req.query['code'];

  if (code && typeof code === 'string') {
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
        message: 'Authentication successful! Bot is ready.',
        userId: shortLived.user_id,
        expiresInDays: Math.round(longLived.expires_in / 86400),
      });
    } catch (err) {
      logger.error('Auth callback failed', { error: err.message });
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Start OAuth flow
  const config = getAuthConfig();
  const client = new ThreadsClient(config);
  const expectedState = randomBytes(24).toString('hex');
  const authUrl = client.buildAuthUrl(expectedState);

  res.setHeader('Set-Cookie', 'oauth_state=' + expectedState + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=600');
  return res.redirect(authUrl);
}
