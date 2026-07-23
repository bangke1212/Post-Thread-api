// api/x-reply.js — X Auto-Reply Agent (Vercel + VPS)
// 100% FREE & LEGAL — supports: @username mode + direct tweet URL mode
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
    oauth_consumer_key: h.apiKey, oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: Math.floor(Date.now()/1000).toString(),
    oauth_token: h.accessToken, oauth_version: '1.0',
  };
  const sorted = Object.keys(oauth).sort();
  const paramStr = sorted.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`).join('&');
  const sigBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const signingKey = `${encodeURIComponent(h.apiSecret)}&${encodeURIComponent(h.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(sigBase).digest('base64');
  return 'OAuth ' + sorted.map(k => `${k}="${encodeURIComponent(oauth[k])}"`).join(', ');
}

// ====== READ: specific tweet by URL (FxTwitter) ======
async function fetchTweetByUrl(tweetUrl) {
  const resp = await fetch(`https://api.fxtwitter.com/i/status/${tweetUrl.split('/status/')[1]?.replace(/[^0-9]/g,'')}`);
  if (!resp.ok) throw new Error(`FxTwitter ${resp.status}`);
  const data = await resp.json();
  if (!data.tweet) return null;
  const t = data.tweet;
  return { id: t.id, text: t.text || '', created_at: t.created_at || new Date().toISOString(), url: t.url, source: 'fxtwitter-direct' };
}

// ====== READ: latest tweet by @username ======
async function fetchLatestTweet(username) {
  // Try FxTwitter
  try { const resp = await fetch(`https://api.fxtwitter.com/${username}/tweets`); if(resp.ok){const d=await resp.json();if(d.tweets?.length){const t=d.tweets[0];return{id:t.id,text:t.text||'',created_at:t.created_at||new Date().toISOString(),url:`https://x.com/${username}/status/${t.id}`,source:'fxtwitter'};}} } catch(e){}
  // Try Nitter
  for (const base of ['https://nitter.net','https://nitter.privacydev.net']) {
    try { const r=await fetch(`${base}/${username}/rss`,{headers:{'User-Agent':'Mozilla/5.0'}}); if(r.ok){const x=await r.text();const im=x.match(/<item>([\s\S]*?)<\/item>/);if(im){const i=im[1];const lk=(i.match(/<link>(.*?)<\/link>/)||[])[1]||'';const id=lk.split('/status/')[1]?.replace(/[^0-9]/g,'')||'0';const tx=((i.match(/<title>(.*?)<\/title>/)||[])[1]||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim();const dt=(i.match(/<pubDate>(.*?)<\/pubDate>/)||[])[1]||new Date().toISOString();if(tx)return{id,text:tx.slice(0,500),created_at:new Date(dt).toISOString(),url:`https://x.com/${username}/status/${id}`,source:'nitter'};}} } catch(e){continue;}
  }
  return null;
}

// ====== AI: generate reply ======
async function generateReply(tweetText, authorName, agnesKey) {
  if (!agnesKey) return `Nice post @${authorName}! ⟤�;
  const resp = await fetch(`${AGNES_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agnesKey}` },
    body: JSON.stringify({ model: AGNES_MODEL, messages: [
      { role: 'system', content: `Kamu adalah social media assistant. Balas tweet dari @${authorName} dengan reply yang engaging, singkat (max 250 char), natural. Bahasa Indonesia casual. JANGAN hashtag. JANGAN mention user lain.` },
      { role: 'user', content: `Tweet dari @${authorName}:\n"${tweetText}"\n\nBalas tweet ini dengan 1-2 kalimat engaging:` }
    ], temperature: 0.85, max_tokens: 150 }),
  });
  const data = await resp.json();
  return (data.choices?.[0]?.message?.content || 'Setuju! ⟤�').trim().replace(/^"|"$/g, '').trim();
}

// ====== POST: X API FREE ======
async function postReply(tweetId, text, h) {
  const url = 'https://api.x.com/2/tweets';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': oauthHeader('POST', url, h), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, reply: { in_reply_to_tweet_id: tweetId } }),
  });
  if (!resp.ok) { const err = await resp.text(); throw new Error(`Post failed ${resp.status}: ${err.slice(0,500)}`); }
  return resp.json();
}

// ====== MAIN HANDLER ======
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, X-Api-Secret, X-Access-Token, X-Access-Secret, X-Agnes-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const url = new URL(req.url, 'http://localhost');
  const dryRun = url.searchParams.get('dry') === 'true';
  const tweetUrl = url.searchParams.get('tweet_url') || '';
  const target = url.searchParams.get('target') || TARGET;
  const h = getHeaders(req);
  
  try {
    // MODE 1: Direct tweet URL
    let tweet;
    if (tweetUrl) {
      tweet = await fetchTweetByUrl(tweetUrl);
      if (!tweet) return res.json({ status: 'idle', message: `Could not fetch tweet from URL: ${tweetUrl}` });
    } else {
      // MODE 2: @username mode
      tweet = await fetchLatestTweet(target);
      if (!tweet) return res.json({ status: 'idle', message: `No recent tweets from @${target}. Coba akun lain atau paste URL tweet langsung.` });
    }
    
    const replyText = await generateReply(tweet.text, target, h.agnes);
    
    if (dryRun) {
      return res.json({ status: 'dry_run', tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at }, reply: replyText, message: 'Dry run — no post made', source: tweet.source });
    }
    
    if (!h.apiKey || !h.accessToken) {
      return res.json({ status: 'dry_run', tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at }, reply: replyText, message: 'AI reply generated. To post, set X OAuth creds.', source: tweet.source });
    }
    
    const posted = await postReply(tweet.id, replyText, h);
    return res.json({ status: 'replied', tweet: { id: tweet.id, text: tweet.text.slice(0,200), created_at: tweet.created_at }, reply: replyText, reply_id: posted.data?.id, url: tweet.url, source: tweet.source + ' + x-api-free' });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
