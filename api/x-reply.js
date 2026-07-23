// api/x-reply.js — v2.1 with debug, User-Agent, v1.1 fallback
import crypto from 'node:crypto';

var T = process.env.X_TARGET_USER || 'bov4l';

// ── Extract credentials from headers or env ──
function H(r) {
  return {
    ak: r.headers['x-api-key'] || process.env.X_API_KEY || '',
    as: r.headers['x-api-secret'] || process.env.X_API_SECRET || '',
    at: r.headers['x-access-token'] || process.env.X_ACCESS_TOKEN || '',
    ats: r.headers['x-access-secret'] || process.env.X_ACCESS_SECRET || '',
    ag: r.headers['x-agnes-key'] || process.env.AGNES_API_KEY || process.env.OPENROUTER_API_KEY || ''
  };
}

var AB = 'https://apihub.agnes-ai.com/v1', AM = 'agnes-2.0-flash';

// ── OAuth 1.0a signature builder ──
function O(m, u, h) {
  var o = {
    oauth_consumer_key: h.ak,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: h.at,
    oauth_version: '1.0'
  };
  var s = Object.keys(o).sort();
  var p = s.map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]);
  }).join('&');
  var b = m.toUpperCase() + '&' + encodeURIComponent(u) + '&' + encodeURIComponent(p);
  var sk = encodeURIComponent(h.as) + '&' + encodeURIComponent(h.ats);
  o.oauth_signature = crypto.createHmac('sha1', sk).update(b).digest('base64');
  return 'OAuth ' + s.map(function(k) {
    return k + '="' + encodeURIComponent(o[k]) + '"';
  }).join(', ');
}

// ── Fetch tweet from URL ──
async function FU(tu) {
  var ti = tu.split('/status/')[1] ? tu.split('/status/')[1].replace(/[^0-9]/g, '') : '';
  var r = await fetch('https://api.fxtwitter.com/i/status/' + ti);
  if (!r.ok) throw new Error('FxTwitter ' + r.status);
  var d = await r.json();
  if (!d.tweet) return null;
  var t = d.tweet;
  var auth = (t.author && t.author.screen_name) || '';
  return {
    id: t.id,
    text: t.text || '',
    created_at: t.created_at || new Date().toISOString(),
    url: t.url,
    author: auth,
    source: 'fxtwitter-direct'
  };
}

// ── Fetch latest tweet from username ──
async function FL(u) {
  try {
    var r = await fetch('https://api.fxtwitter.com/' + u + '/tweets');
    if (r.ok) {
      var d = await r.json();
      if (d.tweets && d.tweets.length) {
        var t = d.tweets[0];
        return {
          id: t.id,
          text: t.text || '',
          created_at: t.created_at || new Date().toISOString(),
          url: 'https://x.com/' + u + '/status/' + t.id,
          author: u,
          source: 'fxtwitter'
        };
      }
    }
  } catch(e) {}

  var ni = ['https://nitter.net', 'https://nitter.privacydev.net'];
  for (var b of ni) {
    try {
      var rr = await fetch(b + '/' + u + '/rss', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (rr.ok) {
        var x = await rr.text();
        var im = x.match(/<item>([\s\S]*?)<\/item>/);
        if (im) {
          var i = im[1];
          var lk = (i.match(/<link>(.*?)<\/link>/) || [])[1] || '';
          var id = lk.split('/status/')[1] ? lk.split('/status/')[1].replace(/[^0-9]/g, '') : '0';
          var tx = ((i.match(/<title>(.*?)<\/title>/) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          var dt = (i.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || new Date().toISOString();
          if (tx) return {
            id: id,
            text: tx.slice(0, 500),
            created_at: new Date(dt).toISOString(),
            url: 'https://x.com/' + u + '/status/' + id,
            author: u,
            source: 'nitter'
          };
        }
      }
    } catch(e) { continue; }
  }
  return null;
}

// ── Generate AI reply ──
async function GR(tt, an, ak) {
  if (!ak) return 'Nice post @' + an + '!';
  var r = await fetch(AB + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ak
    },
    body: JSON.stringify({
      model: AM,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah social media assistant. Balas tweet dari @' + an +
            ' dengan reply yang engaging, singkat (max 250 char), natural. Bahasa Indonesia casual. JANGAN hashtag. JANGAN mention user lain.'
        },
        {
          role: 'user',
          content: 'Tweet dari @' + an + ':\n"' + tt + '"\n\nBalas tweet ini dengan 1-2 kalimat engaging:'
        }
      ],
      temperature: 0.85,
      max_tokens: 150
    })
  });
  var d = await r.json();
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || 'Setuju!')
    .trim().replace(/^"|"$/g, '').trim();
}

// ── Post reply to X (v2 → fallback v1.1) ──
async function PR(ti, tx, h) {
  var ua = { 'User-Agent': 'PostThreadBot/2.1' };

  // ═══ Try X API v2 first ═══
  var u2 = 'https://api.x.com/2/tweets';
  var r2 = await fetch(u2, {
    method: 'POST',
    headers: Object.assign({
      'Authorization': O('POST', u2, h),
      'Content-Type': 'application/json'
    }, ua),
    body: JSON.stringify({
      text: tx,
      reply: { in_reply_to_tweet_id: ti }
    })
  });

  if (r2.ok) return { data: await r2.json(), via: 'v2' };

  var e2 = await r2.text();
  console.log('[x-reply] v2 failed', r2.status, e2.slice(0, 300));

  // ═══ Fallback: X API v1.1 ═══
  var u1 = 'https://api.twitter.com/1.1/statuses/update.json';
  var body1 = new URLSearchParams({
    status: tx,
    in_reply_to_status_id: ti,
    auto_populate_reply_metadata: 'true'
  }).toString();

  var r1 = await fetch(u1, {
    method: 'POST',
    headers: Object.assign({
      'Authorization': O('POST', u1, h),
      'Content-Type': 'application/x-www-form-urlencoded'
    }, ua),
    body: body1
  });

  if (r1.ok) {
    var d1 = await r1.json();
    return { data: { id: d1.id_str || d1.id }, via: 'v1.1' };
  }

  var e1 = await r1.text();
  console.log('[x-reply] v1.1 failed', r1.status, e1.slice(0, 300));

  throw new Error(
    'Post failed. v2=' + r2.status + ' v1.1=' + r1.status +
    '. v2: ' + e2.slice(0, 150) + ' | v1.1: ' + e1.slice(0, 150)
  );
}

// ═══════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, X-Api-Key, X-Api-Secret, X-Access-Token, X-Access-Secret, X-Agnes-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  var u = new URL(req.url, 'http://localhost');
  var dr = u.searchParams.get('dry') === 'true';
  var tu = u.searchParams.get('tweet_url') || '';
  var ta = u.searchParams.get('target') || T;
  var h = H(req);

  // ── 🔍 DEBUG ENDPOINT ──
  if (u.searchParams.get('debug') === 'true') {
    return res.json({
      status: 'debug',
      target: ta,
      credentials: {
        X_API_KEY: h.ak ? h.ak.slice(0, 8) + '...' : '❌ EMPTY',
        X_API_SECRET: h.as ? '✅ SET (hidden)' : '❌ EMPTY',
        X_ACCESS_TOKEN: h.at ? h.at.slice(0, 8) + '...' : '❌ EMPTY',
        X_ACCESS_SECRET: h.ats ? '✅ SET (hidden)' : '❌ EMPTY',
        AGNES_KEY: h.ag ? h.ag.slice(0, 8) + '...' : '❌ EMPTY'
      },
      can_post: !!(h.ak && h.at),
      dry_run: dr,
      tip: (!h.ak || !h.at)
        ? '⚠️ X API credentials NOT SET in Vercel env vars. Add X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.'
        : '✅ Credentials found. Try ?dry=true to test AI reply first.'
    });
  }

  try {
    var tw;

    // Fetch tweet
    if (tu) {
      tw = await FU(tu);
      if (!tw) return res.json({ status: 'idle', message: 'Could not fetch tweet from URL: ' + tu });
      if (tw.author) ta = tw.author;
    } else {
      tw = await FL(ta);
      if (!tw) return res.json({
        status: 'idle',
        message: 'No recent tweets from @' + ta + '. Coba akun lain atau paste URL tweet langsung.'
      });
    }

    // Generate AI reply
    var rt = await GR(tw.text, ta, h.ag);

    // Dry run
    if (dr) {
      return res.json({
        status: 'dry_run',
        tweet: { id: tw.id, text: tw.text.slice(0, 200), created_at: tw.created_at },
        reply: rt,
        message: 'Dry run — no post made',
        source: tw.source
      });
    }

    // Missing credentials → return reply without posting
    if (!h.ak || !h.at) {
      return res.json({
        status: 'no_credentials',
        tweet: { id: tw.id, text: tw.text.slice(0, 200), created_at: tw.created_at },
        reply: rt,
        message: '⚠️ AI reply generated but X credentials missing. Add X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET to Vercel env vars to post.',
        source: tw.source
      });
    }

    // Post reply (v2 → v1.1 fallback)
    var po = await PR(tw.id, rt, h);

    return res.json({
      status: 'replied',
      tweet: { id: tw.id, text: tw.text.slice(0, 200), created_at: tw.created_at },
      reply: rt,
      reply_id: po.data && po.data.id,
      url: tw.url || 'https://x.com/' + ta + '/status/' + tw.id,
      source: tw.source + ' + x-api-' + (po.via || 'v2')
    });

  } catch(err) {
    return res.status(500).json({
      status: 'error',
      error: err.message,
      hint: err.message.includes('401')
        ? '🔑 401 Unauthorized — cek X API credentials di Vercel env vars & pastikan X App ter-attach ke Project di developer.x.com'
        : 'Coba ?debug=true untuk cek status kredensial'
    });
  }
}
