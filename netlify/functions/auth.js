exports.handler = async (event, context) => {
  const appId = process.env['THREADS_APP_ID'];
  const appSecret = process.env['THREADS_APP_SECRET'];
  
  if (!appId || !appSecret) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Missing env vars',
        hasAppId: !!appId,
        hasAppSecret: !!appSecret
      }) 
    };
  }
  
  // Redirect to Meta OAuth
  const crypto = require('crypto');
  const state = crypto.randomBytes(24).toString('hex');
  const redirectUri = process.env['THREADS_REDIRECT_URI'] || 'https://postthreadpost.netlify.app/.netlify/functions/auth';
  
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: 'threads_basic,threads_content_publish',
    response_type: 'code',
    state
  });
  
  const authUrl = 'https://threads.net/oauth/authorize?' + params.toString();
  
  return {
    statusCode: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': 'oauth_state=' + state + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=600'
    }
  };
};
