// api/x-reply.js — X Auto-Reply Agent (Vercel + VPS)
// 100% FREE & LEGAL — multiple fallback readers:
//   1. FxTwitter API     (free, no auth)
//   2. Nitter RSS        (free, no auth)
//   3. X.com Syndication (free, official embed API)
import crypto from 'node:crypto';

const TARGET = process.env.X_TARGET_USER || 'bov4l';

function getHeaders(req) {
  return {
    apiKey:      req.headers['x-api-key']      || process.env.X_API_KEY || '',
    apiSecret:   req.headers['x-api-secret']   || process.env.X_API_SECRET || '',
    accessToken: req.headers['x-access-token'] || process.env.X_ACCESS_TOKEN || '',
    accessSecret:req.headers['x-access-secret']|| process.env.X_ACCESS_SECRET || '',
    agnes:       req.headers['x-agnes-key']    || process.env.AGNES_API_KEY || process.env.OPENROUTER_API_KEY || '',
  };
}

const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const AGNES_MODEL = 'agnes-2.0-flash';

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

// ========== READ METHODS (all FREE) ==========

// Method 1: FxTwitter API
async function fetchFxTwitter(username) {
  const resp = await fetch(`https://api.fxtwitter.com/${username}/tweets`);
  if (!resp.ok) throw new Error(`FxTwitter ${resp.status}`);
  const data = await resp.json();
  if (!data.tweets || data.tweets.length === 0) return null;
  const t = data.tweets[0];
  return { id: t.id, text: t.text || '', created_at: t.created_at || new Date().toISOString(), url: `https://x.com/${username}/status/${t.id}`, source: 'fxtwitter' };
}

// Method 2: Nitter RSS (multiple instances)
async function fetchNitter(username) {
  const instances = [
    `https://nitter.net/${username}/rss`,
    `https://nitter.privacydev.net/${username}/rss`,
    `https://nitter.poast.org/${username}/rss`,
  ];
  for (const url of instances) {
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!resp.ok) continue;
      const xml = await resp.text();
      // Parse first <item> from RSS
      const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
      if (!itemMatch) continue;
      const item = itemMatch[1];
      const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
      const id = link.split('/status/')[1]?.replace(/[^0-9]/g,'') || '0';
      const text = ((item.match(/<title>(.*?)<\/title>/) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g,'').trim();
      const date = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || new Date().toISOString();
      if (!text) continue;
      return { id, text: text.slice(0, 500), created_at: new Date(date).toISOString(), url: `https://x.com/${username}/status/${id}`, source: 'nitter' };
    } catch(e) { continue; }
  }
  throw new Error('Nitter all instances failed');
}

// Method 3: X.com Syndication (official embed — no auth)
async function fetchXSyndication(username) {
  const resp = await fetch(`https://cdn.syndication.twimg.com/widgets/timelines/1234567890123456789?&lang=en&screen_name=${username}&suppress_response_codes=true&r=${Date.now()}`);
  if (!resp.ok) throw new Error(`X Syndication ${resp.status}`);
  const html = await resp.text();
  // Extract first tweet text from the HTML
  const tweetMatch = html.match(/class="e-entry-title[^"]*"[^>]*>([\s\S]*?)<\/p>/);
  if (!tweetMatch) return null;
  const text = tweetMatch[1].replace(/<[^>]+>/g, '').trim();
  if (!text) return null;
  return { id: '0', text: text.slice(0, 500), created_at: new Date().toISOString(), url: `https://x.com/${username}`, source: 'x-syndication' };
}

// Main fetch: try all 3 methods
async function fetchLatestTweet(username) {
  const errors = [];
  
  // Try FxTwitter
  try { const t = await fetchFxTwitter(username); if (t) return t; } catch(e) { errors.push('FxTwitter: '+e.message); }
  
  // Try Nitter
  try { const t = await fetchNitter(username); if (t) return t; } catch(e) { errors.push('Nitter: '+e.message); }
  
  // Try X Syndication
  try { const t = await fetchXSyndication(username); if (t) return t; } catch(e) { errors.push('X Syndication: '+e.message); }
  
  // All failed — return null with debug info
  return null;
}

// ========== AI GENERATE (FREE) ==========
async function generateReply(tweetText, authorName, agnesKey) {
  if (!agnesKey) return `Nice post @${authorName}! 🔥`;
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

// ========== POST (X API FREE) ==========
async function postReply(tweetId, text, h) {
  const url = 'https://api.x.com/2/tweets';
  const body = JSON.stringify({ text, reply: { in_reply_to_tweet_id: tweetId } });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': oauthHeader('POST', url, h), 'Content-Type': 'application/json' },
    body,
  });
  if (!resp.ok) { const err = await resp.text(); throw new Error(`Post failed ${resp.status}: ${err.slice(0,500)}`); }
  return resp.json();
}

// ========== MAIN HANDLER ==========
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
    const tweet = await fetchLatestTweet(target);
    if (!tweet) {
      return res.json({ status: 'idle', message: `No recent tweets from @${target}. Possible: akun ga ada, kosong, private, atau rate-limited. Coba akun lain seperti @bov4l atau @elonmusk.` });
    }
    
    const replyText = await generateReply(tweet.text, target, h.agnes);
    
    if (dryRun) {
      return res.json({ status: 'dry_run', tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at }, reply: replyText, message: 'Dry run — no post made', source: tweet.source });
    }
    
    if (!h.apiKey || !h.accessToken) {
      return res.json({ status: 'dry_run', tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at }, reply: replyText, message: 'AI reply generated. To post, set X OAuth creds.', note: 'X API FREE: POST /2/tweets IS free.', source: tweet.source });
    }
    
    const posted = await postReply(tweet.id, replyText, h);
    return res.json({ status: 'replied', tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at }, reply: replyText, reply_id: posted.data?.id, url: `https://x.com/${target}/status/${tweet.id}`, source: tweet.source + ' + x-api-free' });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
