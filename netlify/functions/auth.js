// api/auth.js — OAuth auth endpoint for Vercel (self-contained)
const { randomBytes } = require('crypto');

// --- Inline config reader ---
function getAuthConfig() {
  const appId = process.env['THREADS_APP_ID'];
  const appSecret = process.env['THREADS_APP_SECRET'];
  const redirectUri = process.env['THREADS_REDIRECT_URI'] || 'https://post-thread-api.vercel.app/api/auth';
  if (!appId) throw new Error('Missing THREADS_APP_ID');
  if (!appSecret) throw new Error('Missing THREADS_APP_SECRET');
  return { threadsAppId: appId, threadsAppSecret: appSecret, threadsRedirectUri: redirectUri };
}

// --- Inline logger ---
const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
function emit(level, message, meta) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;
  const entry = { ts: new Date().toISOString(), level, message, ...meta };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'critical') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}
const logger = {
  debug: (m, meta) => emit('debug', m, meta),
  info: (m, meta) => emit('info', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  error: (m, meta) => emit('error', m, meta),
  critical: (m, meta) => emit('critical', m, meta),
};

// --- Inline Threads API client (minimal) ---
const BASE_URL = 'https://graph.threads.net/v1.0';
const AUTH_BASE = 'https://threads.net/oauth';
const TOKEN_BASE = 'https://graph.threads.net';

async function apiFetch(url, opts) {
  let res;
  try { res = await fetch(url, opts); }
  catch (err) { throw new Error('Network error: ' + err.message); }
  if (res.status === 401) throw new Error('Auth failed');
  if (res.status === 429) throw new Error('Rate limited');
  if (res.status >= 500) throw new Error('Threads API server error ' + res.status);
  if (!res.ok) {
    const body = await res.text();
    throw new Error('Threads API error ' + res.status + ': ' + body);
  }
  return res.json();
}

class ThreadsClient {
  constructor(config) { this.config = config; }

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
    return apiFetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  async getLongLivedToken(shortToken, userId) {
    const params = new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: this.config.threadsAppSecret,
      access_token: shortToken,
    });
    return apiFetch(TOKEN_BASE + '/access_token?' + params.toString(), { method: 'GET' });
  }

  async getCurrentUserProfile(accessToken) {
    const params = new URLSearchParams({ fields: 'id,username,name' });
    return apiFetch(BASE_URL + '/me?' + params.toString(), {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
  }
}

// --- Inline storage ---
const fs = require('fs');
const path = require('path');
const DB_DIR = process.env['DB_DIR'] || '/tmp';
const DB_FILE = path.join(DB_DIR, 'threads-bot-db.json');

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
  catch { return { tokens: [], posts: [], settings: {} }; }
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function saveToken(secret, accessToken, expiresAt, userId) {
  const db = readDb();
  db.tokens = db.tokens.filter(t => t.id !== 'default');
  db.tokens.push({
    id: 'default',
    access_token: accessToken,
    refreshed_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    user_id: userId || null,
  });
  writeDb(db);
}

// --- MAIN HANDLER ---
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
};
