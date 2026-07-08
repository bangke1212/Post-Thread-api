// netlify/functions/auth.js
import { getConfig } from './config.js';

export default async (req) => {
  const config = getConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  // OAuth callback
  if (code) {
    try {
      const body = new URLSearchParams({
        client_id: config.threadsAppId,
        client_secret: config.threadsAppSecret,
        grant_type: 'authorization_code',
        redirect_uri: config.threadsRedirectUri,
        code,
      });

      const res = await fetch('https://graph.threads.net/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Get long-lived token
      const llRes = await fetch(
        `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${config.threadsAppSecret}&access_token=${data.access_token}`
      );
      
      if (!llRes.ok) throw new Error('Long-lived token exchange failed');
      const llData = await llRes.json();

      return new Response(`
        <html><body style="font-family:sans-serif;max-width:500px;margin:50px auto;text-align:center">
          <h1>✅ Auth Successful!</h1>
          <p>Your long-lived access token (save this as THREADS_ACCESS_TOKEN in env vars):</p>
          <textarea readonly style="width:100%;height:80px;font-family:monospace;font-size:12px;padding:8px;border-radius:6px;background:#111;color:#22c55e;border:1px solid #333">${llData.access_token}</textarea>
          <p style="color:#666;font-size:13px">Expires: ${new Date(Date.now() + llData.expires_in * 1000).toLocaleDateString()}</p>
          <p><a href="/" style="color:#6366f1">Back to Dashboard</a></p>
        </body></html>
      `, { status: 200, headers: { 'Content-Type': 'text/html' } });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // Start OAuth
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: config.threadsAppId,
    redirect_uri: config.threadsRedirectUri,
    scope: 'threads_basic,threads_content_publish',
    response_type: 'code',
    state,
  });

  return Response.redirect(`https://threads.net/oauth/authorize?${params}`);
};

export const config = { path: '/auth' };
