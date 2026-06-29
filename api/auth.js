// api/auth.cjs — OAuth auth endpoint for Vercel
const { randomBytes } = require('crypto');
const { getAuthConfig } = require('../dist/config.js');
const { ThreadsClient } = require('../dist/threads-api.js');
const { logger } = require('../dist/logger.js');

module.exports = async function handler(req, res) {
  const code = req.query['code'];

  if (code && typeof code === 'string') {
    try {
      const config = getAuthConfig();
      const client = new ThreadsClient(config);
      logger.info('Exchanging OAuth code for token...');
      const shortLived = await client.exchangeCode(code);
      await client.getLongLivedToken(shortLived.access_token, shortLived.user_id);
      logger.info('Auth successful');
      return res.status(200).json({ success: true, message: 'Auth successful!' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Start OAuth flow
  try {
    const config = getAuthConfig();
    const client = new ThreadsClient(config);
    const expectedState = randomBytes(24).toString('hex');
    const authUrl = client.buildAuthUrl(expectedState);
    res.setHeader('Set-Cookie', 'oauth_state=' + expectedState + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=600');
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: 'Config error: ' + err.message });
  }
}
