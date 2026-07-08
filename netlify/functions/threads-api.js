// netlify/functions/threads-api.js
import { logger } from './logger.js';

export async function publishToThreads(config, text) {
  // Get long-lived token from storage or env
  // For now, use token from env (user sets after OAuth)
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('No THREADS_ACCESS_TOKEN set. Run OAuth first.');
  }

  logger.info('Publishing to Threads', { textLength: text.length });
  
  // Step 1: Create media container
  const createRes = await fetch(
    `https://graph.threads.net/v1.0/${config.threadsAppId}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: text,
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Threads create failed: ${err.slice(0, 200)}`);
  }

  const { id: creationId } = await createRes.json();
  logger.info('Container created', { creationId });

  // Step 2: Publish
  const publishRes = await fetch(
    `https://graph.threads.net/v1.0/${config.threadsAppId}/threads_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ creation_id: creationId }),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`Threads publish failed: ${err.slice(0, 200)}`);
  }

  const { id: postId } = await publishRes.json();
  logger.info('Published to Threads', { postId });
  
  return postId;
}

export async function exchangeToken(config, code) {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function getLongLivedToken(config, shortToken) {
  const res = await fetch(
    `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${config.threadsAppSecret}&access_token=${shortToken}`
  );

  if (!res.ok) throw new Error('Long-lived token exchange failed');
  
  const data = await res.json();
  return { token: data.access_token, expiresIn: data.expires_in };
}
