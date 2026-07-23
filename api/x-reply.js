// api/x-reply.js — X Auto-Reply Agent (Vercel + VPS)
// Monitor @bov4l, generate AI reply via Agnes, post to X
import crypto from 'node:crypto';

// === CONFIG (env or headers) ===
const TARGET = process.env.X_TARGET_USER || 'bov4l';

function getHeaders(req) {
  return {
    bearer: req.headers['x-bearer-token'] || process.env.X_BEARER_TOKEN || '',
    agnes: req.headers['x-agnes-key'] || process.env.AGNES_API_KEY || process.env.OPENROUTER_API_KEY || '',
    apiKey: req.headers['x-bearer-token'] || process.env.X_API_KEY || '',
    apiSecret: req.headers['x-api-secret'] || process.env.X_API_SECRET || '',
    accessToken: req.headers['x-access-token'] || process.env.X_ACCESS_TOKEN || '',
    accessSecret: req.headers['x-access-secret'] || process.env.X_ACCESS_SECRET || '',
  };
}

const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const AGNES_MODEL = 'agnes-2.0-flash';

// === OAuth 1.0a Signer (for X API v2 posting) ===
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

// === Fetch latest tweet by username ===
async function fetchLatestTweet(username, h) {
  const url = `https://api.x.com/2/tweets/search/recent?query=from:${username}&max_results=5&tweet.fields=created_at,public_metrics`;
  const headers = {};
  if (h.bearer) {
    headers['Authorization'] = `Bearer ${h.bearer}`;
  } else if (h.apiKey && h.accessToken) {
    headers['Authorization'] = oauthHeader('GET', url, {}, h);
  } else {
    throw new Error('Need X Bearer Token. Set in dashboard Config API or env X_BEARER_TOKEN');
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
async function generateReply(tweetText, authorName, agnesKey) {
  if (!agnesKey) {
    return `Nice post @${authorName}! 馃憠`;
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
  return (data.choices?.[0]?.message?.content || 'Setuju! 馃憤').trim().replace(/^"|"$/g, '').replace(`@${authorName}`, '').trim();
}

// === Post reply via X API v2 ===
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
        message: 'Dry run — no post made',
      });
    }
    
    if (!h.apiKey || !h.accessToken) {
      return res.json({
        status: 'dry_run',
        tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at },
        reply: replyText,
        message: 'AI reply generated. To post, set X OAuth credentials (API Key + Access Token) in env or dashboard.',
        note: 'Bearer token read-only — need OAuth 1.0a to post',
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
