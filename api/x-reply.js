// api/x-reply.js — X Auto-Reply Agent (Vercel + VPS)
// Monitor @target, generate AI reply via Agnes, post to X
// Uses FREE FxTwitter API for tweet fetching (no X API credits needed)
import crypto from 'node:crypto';

// === CONFIG (env or headers) ===
const TARGET = process.env.X_TARGET_USER || 'bov4l';

function getHeaders(req) {
  return {
    // Free tweet reading: no auth needed via FxTwitter
    // X API fallback (optional)
    bearer: req.headers['x-bearer-token'] || process.env.X_BEARER_TOKEN || '',
    agnes: req.headers['x-agnes-key'] || process.env.AGNES_API_KEY || process.env.OPENROUTER_API_KEY || '',
    // For posting replies (OAuth 1.0a — only if you want to actually post)
    apiKey: process.env.X_API_KEY || '',
    apiSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessSecret: process.env.X_ACCESS_SECRET || '',
  };
}

const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const AGNES_MODEL = 'agnes-2.0-flash';

// === OAuth 1.0a Signer (for X API v2 posting only) ===
function oauthHeader(method, url, params, h) {
  const oauth = {
    oauth_consumer_key: h.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: h.accessToken,
    oauth_version: '1.0',
    ...params,
  };
  const sorted = Object.keys(oauth).sort();
  const paramStr = sorted.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`).join('&');
  const sigBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const signingKey = `${encodeURIComponent(h.apiSecret)}&${encodeURIComponent(h.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(sigBase).digest('base64');
  return 'OAuth ' + sorted.map(k => `${k}="${encodeURIComponent(oauth[k])}"`).join(', ');
}

// === Fetch latest tweet via FREE FxTwitter API (no auth needed!) ===
async function fetchLatestTweetFree(username) {
  // FxTwitter — free, no API key needed
  const url = `https://api.fxtwitter.com/${username}/tweets`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FxTwitter error ${resp.status}`);
  const data = await resp.json();
  if (!data.tweets || data.tweets.length === 0) return null;
  // Return latest tweet
  const latest = data.tweets[0];
  return {
    id: latest.id,
    text: latest.text || '',
    created_at: latest.created_at || new Date().toISOString(),
    url: latest.url || `https://x.com/${username}/status/${latest.id}`,
  };
}

// === Fetch via X API v2 (fallback — costs credits) ===
async function fetchLatestTweetAPI(username, h) {
  const url = `https://api.x.com/2/tweets/search/recent?query=from:${username}&max_results=5&tweet.fields=created_at,public_metrics`;
  const headers = {};
  if (h.bearer) {
    headers['Authorization'] = `Bearer ${h.bearer}`;
  } else if (h.apiKey && h.accessToken) {
    headers['Authorization'] = oauthHeader('GET', url, {}, h);
  } else {
    throw new Error('Need credentials for X API');
  }
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const err = await resp.text();
    // If credits depleted, return null (caller will use free method)
    if (resp.status === 402 || resp.status === 429) return null;
    throw new Error(`X API error ${resp.status}: ${err.slice(0,500)}`);
  }
  const data = await resp.json();
  const tweets = (data.data || []).sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
  const t = tweets[0];
  if (!t) return null;
  return {
    id: t.id,
    text: t.text || '',
    created_at: t.created_at,
    url: `https://x.com/${username}/status/${t.id}`,
  };
}

// === Fetch latest tweet — try FREE first, X API as backup ===
async function fetchLatestTweet(username, h) {
  // 1. ALWAYS try FREE FxTwitter first (no credits needed!)
  try {
    const tweet = await fetchLatestTweetFree(username);
    if (tweet) return tweet;
  } catch (e) {
    console.log(`FxTwitter failed for @${username}: ${e.message}`);
  }
  
  // 2. Fallback: X API (only if bearer token present)
  if (h.bearer || (h.apiKey && h.accessToken)) {
    try {
      const tweet = await fetchLatestTweetAPI(username, h);
      if (tweet) return tweet;
    } catch (e) {
      console.log(`X API failed for @${username}: ${e.message}`);
    }
  }
  
  return null;
}

// === Generate AI reply via Agnes ===
async function generateReply(tweetText, authorName, agnesKey) {
  if (!agnesKey) {
    return `Nice post @${authorName}! `;
  }
  const prompt = [
    { role: 'system', content: `Kamu adalah social media assistant. Balas tweet dari @${authorName} dengan reply yang engaging, singkat (max 250 char), dan natural seperti manusia. Gunakan Bahasa Indonesia casual (gaul tapi sopan). JANGAN gunakan hashtag. JANGAN mention user lain kecuali author. Reply harus relate dengan isi tweet.` },
    { role: 'user', content: `Tweet dari @${authorName}:\n"${tweetText}"\n\nBalas tweet ini dengan 1-2 kalimat yang engaging:` }
  ];
  const resp = await fetch(`${AGNES_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agnesKey}` },
    body: JSON.stringify({ model: AGNES_MODEL, messages: prompt, temperature: 0.85, max_tokens: 150 }),
  });
  const data = await resp.json();
  return (data.choices?.[0]?.message?.content || 'Setuju! ').trim().replace(/^"|"$/g, '').replace(`@${authorName}`, '').trim();
}

// === Post reply via X API v2 (needs OAuth — only for actual posting) ===
async function postReply(tweetId, text, h) {
  const url = 'https://api.x.com/2/tweets';
  const body = JSON.stringify({ text, reply: { in_reply_to_tweet_id: tweetId } });
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': oauthHeader('POST', url, {}, h),
      'Content-Type': 'application/json',
    },
    body,
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Post failed ${resp.status}: ${err.slice(0,500)}`);
  }
  return resp.json();
}

// === MAIN HANDLER ===
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bearer-Token, X-Agnes-Key, X-Api-Key, X-Access-Token, X-Access-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const url = new URL(req.url, 'http://localhost');
  const dryRun = url.searchParams.get('dry') === 'true';
  const target = url.searchParams.get('target') || TARGET;
  const h = getHeaders(req);
  
  try {
    const tweet = await fetchLatestTweet(target, h);
    if (!tweet) {
      return res.json({ status: 'idle', message: `No recent tweets from @${target}` });
    }
    const replyText = await generateReply(tweet.text, target, h.agnes);
    
    if (dryRun) {
      return res.json({
        status: 'dry_run',
        tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at },
        reply: replyText,
        message: 'Dry run — no post made (FREE FxTwitter used for tweet fetch)',
        source: 'fxtwitter',
      });
    }
    
    // Only try to post if OAuth credentials available
    if (!h.apiKey || !h.accessToken) {
      return res.json({
        status: 'dry_run',
        tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at },
        reply: replyText,
        message: 'AI reply generated. To post, add X OAuth creds in env vars.',
        note: 'Tweet fetched via FREE FxTwitter — no X API credits used!',
        source: 'fxtwitter',
      });
    }
    
    const posted = await postReply(tweet.id, replyText, h);
    return res.json({
      status: 'replied',
      tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at },
      reply: replyText,
      reply_id: posted.data?.id,
      url: `https://x.com/${target}/status/${tweet.id}`,
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
