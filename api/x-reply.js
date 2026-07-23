// api/x-reply.js — X Auto-Reply Agent (Vercel + VPS)
// 100% FREE & LEGAL architecture:
//   READ  → FxTwitter RSS (free, no auth)
//   AI    → Agnes AI (free)
//   POST  → X API Free POST /2/tweets (free with OAuth 1.0a)
//   NEVER → X API /2/tweets/search/* (PAID!)
import crypto from 'node:crypto';

// === CONFIG ===
const TARGET = process.env.X_TARGET_USER || 'bov4l';

function getHeaders(req) {
  return {
    // X OAuth 1.0a — for FREE POST /2/tweets
    apiKey:     req.headers['x-api-key']     || process.env.X_API_KEY || '',
    apiSecret:  req.headers['x-api-secret']  || process.env.X_API_SECRET || '',
    accessToken:req.headers['x-access-token']|| process.env.X_ACCESS_TOKEN || '',
    accessSecret:req.headers['x-access-secret']||process.env.X_ACCESS_SECRET||'',
    // AI provider (free)
    agnes:      req.headers['x-agnes-key']   || process.env.AGNES_API_KEY || process.env.OPENROUTER_API_KEY || '',
  };
}

const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const AGNES_MODEL = 'agnes-2.0-flash';

// === OAuth 1.0a Signer (X API Free — POST /2/tweets) ===
function oauthHeader(method, url, h) {
  const oauth = {
    oauth_consumer_key: h.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: h.accessToken,
    oauth_version: '1.0',
  };
  const sorted = Object.keys(oauth).sort();
  const paramStr = sorted.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`).join('&');
  const sigBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const signingKey = `${encodeURIComponent(h.apiSecret)}&${encodeURIComponent(h.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(sigBase).digest('base64');
  return 'OAuth ' + sorted.map(k => `${k}="${encodeURIComponent(oauth[k])}"`).join(', ');
}

// === READ: Fetch latest tweet via FREE FxTwitter (NO auth needed!) ===
async function fetchLatestTweet(username) {
  const url = `https://api.fxtwitter.com/${username}/tweets`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FxTwitter error ${resp.status}`);
  const data = await resp.json();
  if (!data.tweets || data.tweets.length === 0) return null;
  const latest = data.tweets[0];
  return {
    id: latest.id,
    text: latest.text || '',
    created_at: latest.created_at || new Date().toISOString(),
    url: `https://x.com/${username}/status/${latest.id}`,
    source: 'fxtwitter',
  };
}

// === AI: Generate reply via Agnes AI (FREE) ===
async function generateReply(tweetText, authorName, agnesKey) {
  if (!agnesKey) {
    return `Nice post @${authorName}! 🔥`;
  }
  const prompt = [
    { role: 'system', content: `Kamu adalah social media assistant. Balas tweet dari @${authorName} dengan reply yang engaging, singkat (max 250 char), natural seperti manusia. Gunakan Bahasa Indonesia casual. JANGAN hashtag. JANGAN mention user lain.` },
    { role: 'user', content: `Tweet dari @${authorName}:\n"${tweetText}"\n\nBalas tweet ini dengan 1-2 kalimat engaging:` }
  ];
  const resp = await fetch(`${AGNES_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agnesKey}` },
    body: JSON.stringify({ model: AGNES_MODEL, messages: prompt, temperature: 0.85, max_tokens: 150 }),
  });
  const data = await resp.json();
  return (data.choices?.[0]?.message?.content || 'Setuju! 🔥').trim().replace(/^"|"$/g, '').trim();
}

// === POST: Post reply via X API FREE (POST /2/tweets + OAuth 1.0a) ===
async function postReply(tweetId, text, h) {
  const url = 'https://api.x.com/2/tweets';
  const body = JSON.stringify({ text, reply: { in_reply_to_tweet_id: tweetId } });
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': oauthHeader('POST', url, h),
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, X-Api-Secret, X-Access-Token, X-Access-Secret, X-Agnes-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const url = new URL(req.url, 'http://localhost');
  const dryRun = url.searchParams.get('dry') === 'true';
  const target = url.searchParams.get('target') || TARGET;
  const h = getHeaders(req);
  
  try {
    // STEP 1: READ tweet via FREE FxTwitter
    const tweet = await fetchLatestTweet(target);
    if (!tweet) {
      return res.json({ status: 'idle', message: `No recent tweets from @${target}` });
    }
    
    // STEP 2: Generate AI reply via FREE Agnes
    const replyText = await generateReply(tweet.text, target, h.agnes);
    
    // Dry run — don't post
    if (dryRun) {
      return res.json({
        status: 'dry_run',
        tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at },
        reply: replyText,
        message: 'Dry run — no post made (FxTwitter FREE + Agnes FREE)',
        source: 'fxtwitter',
      });
    }
    
    // STEP 3: Post reply via X API FREE (POST /2/tweets)
    if (!h.apiKey || !h.accessToken) {
      return res.json({
        status: 'dry_run',
        tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at },
        reply: replyText,
        message: 'AI reply generated. To post, set X OAuth 1.0a credentials in dashboard.',
        note: 'X API FREE tier: POST /2/tweets IS free. Get OAuth keys at developer.x.com',
        source: 'fxtwitter',
      });
    }
    
    // Actually post!
    const posted = await postReply(tweet.id, replyText, h);
    return res.json({
      status: 'replied',
      tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at },
      reply: replyText,
      reply_id: posted.data?.id,
      url: `https://x.com/${target}/status/${tweet.id}`,
      source: 'fxtwitter + x-api-free',
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
