// api/x-reply.js — X Auto-Reply Agent (Vercel + VPS)
// Monitor @bov4l, generate AI reply via Agnes, post to X
import crypto from 'node:crypto';

// === CONFIG ===
const TARGET = process.env.X_TARGET_USER || 'bov4l';
const AGNES_KEY = process.env.AGNES_API_KEY || process.env.OPENROUTER_API_KEY || '';
const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const AGNES_MODEL = 'agnes-2.0-flash';

const X_API_KEY = process.env.X_API_KEY || '';
const X_API_SECRET = process.env.X_API_SECRET || '';
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN || '';
const X_ACCESS_SECRET = process.env.X_ACCESS_SECRET || '';
const X_BEARER = process.env.X_BEARER_TOKEN || '';

// === OAuth 1.0a Signer (for X API v2 posting) ===
function oauthHeader(method, url, params = {}) {
  const oauth = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
    ...params,
  };
  
  // Build signature base string
  const sorted = Object.keys(oauth).sort();
  const paramStr = sorted.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`).join('&');
  const sigBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  
  const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(sigBase).digest('base64');
  
  const headerVal = 'OAuth ' + sorted.map(k => `${k}="${encodeURIComponent(oauth[k])}"`).join(', ');
  return headerVal;
}

// === Fetch latest tweet by username ===
async function fetchLatestTweet(username) {
  // Try bearer token first (read-only)
  const url = `https://api.x.com/2/tweets/search/recent?query=from:${username}&max_results=5&tweet.fields=created_at,public_metrics`;
  
  const headers = {};
  if (X_BEARER) {
    headers['Authorization'] = `Bearer ${X_BEARER}`;
  } else if (X_API_KEY && X_ACCESS_TOKEN) {
    headers['Authorization'] = oauthHeader('GET', url);
  } else {
    throw new Error('Need X_BEARER_TOKEN or X_API_KEY + X_ACCESS_TOKEN');
  }
  
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`X API error ${resp.status}: ${err.slice(0,500)}`);
  }
  
  const data = await resp.json();
  const tweets = (data.data || []).sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
  return tweets[0] || null;
}

// === Generate AI reply via Agnes ===
async function generateReply(tweetText, authorName) {
  if (!AGNES_KEY) {
    return `Nice post @${authorName}! 👏`;
  }
  
  const prompt = [
    { role: 'system', content: `Kamu adalah social media assistant. Balas tweet dari @${authorName} dengan reply yang engaging, singkat (max 280 char), dan natural seperti manusia. Gunakan Bahasa Indonesia casual (gaul tapi sopan). Jangan gunakan hashtag berlebihan. JANGAN mention user lain kecuali author. Reply harus relate dengan isi tweet.` },
    { role: 'user', content: `Tweet dari @${authorName}:\n"${tweetText}"\n\nBalas tweet ini dengan 1-2 kalimat yang engaging:` }
  ];
  
  const resp = await fetch(`${AGNES_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AGNES_KEY}` },
    body: JSON.stringify({ model: AGNES_MODEL, messages: prompt, temperature: 0.8, max_tokens: 150 }),
  });
  
  const data = await resp.json();
  return (data.choices?.[0]?.message?.content || 'Setuju! 👍').trim().replace(/^"|"$/g, '');
}

// === Post reply via X API v2 ===
async function postReply(tweetId, text) {
  const url = 'https://api.x.com/2/tweets';
  const body = JSON.stringify({ text, reply: { in_reply_to_tweet_id: tweetId } });
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': oauthHeader('POST', url),
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const url = new URL(req.url, 'http://localhost');
  const dryRun = url.searchParams.get('dry') === 'true';
  const target = url.searchParams.get('target') || TARGET;
  
  try {
    // Step 1: Fetch latest tweet
    const tweet = await fetchLatestTweet(target);
    if (!tweet) {
      return res.json({ status: 'idle', message: `No recent tweets from @${target}` });
    }
    
    // Step 2: Generate reply
    const replyText = await generateReply(tweet.text, target);
    
    // Step 3: Post reply (or dry run)
    if (dryRun) {
      return res.json({
        status: 'dry_run',
        tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at },
        reply: replyText,
        message: 'Dry run — no post made',
      });
    }
    
    const posted = await postReply(tweet.id, replyText);
    
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
