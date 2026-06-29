// netlify/functions/auth.js — OAuth handler for Netlify
const crypto = require('crypto');

function getAuthConfig() {
  const appId = process.env['THREADS_APP_ID'];
  const appSecret = process.env['THREADS_APP_SECRET'];
  const redirectUri = process.env['THREADS_REDIRECT_URI'] || 'https://postthreadpost.netlify.app/.netlify/functions/auth';
  if (!appId) throw new Error('Missing THREADS_APP_ID');
  if (!appSecret) throw new Error('Missing THREADS_APP_SECRET');
  return { threadsAppId: appId, threadsAppSecret: appSecret, threadsRedirectUri: redirectUri };
}

exports.handler = async (event, context) => {
  const code = event.queryStringParameters ? event.queryStringParameters['code'] : null;

  // OAuth callback: exchange code for token
  if (code && typeof code === 'string') {
    try {
      const config = getAuthConfig();
      const body = new URLSearchParams({
        client_id: config.threadsAppId,
        client_secret: config.threadsAppSecret,
        grant_type: 'authorization_code',
        redirect_uri: config.threadsRedirectUri,
        code,
      });

      const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        throw new Error('Token exchange failed: ' + errBody);
      }

      const tokenData = await tokenRes.json();
      console.log('OAuth success, got access_token');

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Auth successful! Ready to post.' }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: err.message }),
      };
    }
  }

  // Start OAuth flow
  try {
    const config = getAuthConfig();
    const state = crypto.randomBytes(24).toString('hex');
    const params = new URLSearchParams({
      client_id: config.threadsAppId,
      redirect_uri: config.threadsRedirectUri,
      scope: 'threads_basic,threads_content_publish',
      response_type: 'code',
      state,
    });
    const authUrl = 'https://threads.net/oauth/authorize?' + params.toString();

    return {
      statusCode: 302,
      headers: {
        Location: authUrl,
        'Set-Cookie': 'oauth_state=' + state + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=600',
      },
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Config error: ' + err.message }),
    };
  }
};
