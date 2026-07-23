// api/x-reply.js — v2.4 with Bearer Token (OAuth 2.0) for tweet fetching
import crypto from 'node:crypto';

var T = process.env.X_TARGET_USER || 'bov4l';

// ── Extract credentials from headers or env ──
function H(r) {
  return {
    ak: r.headers['x-api-key'] || process.env.X_API_KEY || '',
    as: r.headers['x-api-secret'] || process.env.X_API_SECRET || '',
    at: r.headers['x-access-token'] || process.env.X_ACCESS_TOKEN || '',
    ats: r.headers['x-access-secret'] || process.env.X_ACCESS_SECRET || '',
    bt: r.headers['x-bearer-token'] || process.env.X_BEARER_TOKEN || '',
    ag: r.headers['x-agnes-key'] || process.env.AGNES_API_KEY || process.env.OPENROUTER_API_KEY || ''
  };
}

var AB = 'https://apihub.agnes-ai.com/v1', AM = 'agnes-2.0-flash';
var UA = 'PostThreadBot/2.4';

// ── OAuth 1.0a signature builder (for POST only) ──
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

// ═══ FETCH HELPERS ═══

// OAuth 2.0 Bearer Token fetch (for reads)
async function btFetch(url, h) {
  return fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + h.bt,
      'User-Agent': UA
    }
  });
}

// OAuth 1.0a fetch (for writes / fallback reads)
async function oaFetch(url, h) {
  return fetch(url, {
    headers: {
      'Authorization': O('GET', url, h),
      'User-Agent': UA
    }
  });
}

// Smart fetch: prefer Bearer Token for reads, fallback to OAuth 1.0a
async function xFetch(url, h) {
  if (h.bt) {
    var r = await btFetch(url, h);
    if (r.ok) return r;
    console.log('[x-reply] Bearer fetch failed', r.status, '→ fallback OAuth 1.0a');
  }
  return oaFetch(url, h);
}

// ═══ X API v2: Fetch user by username ═══
async function getUserId(username, h) {
  var url = 'https://api.x.com/2/users/by/username/' + encodeURIComponent(username);
  var r = await xFetch(url, h);
  if (!r.ok) {
    console.log('[x-reply] getUserId failed:', r.status, await r.text().then(function(t){return t.slice(0,200)}));
    return null;
  }
  var d = await r.json();
  return (d.data && d.data.id) ? d.data.id : null;
}

// ═══ X API v2: Fetch latest tweets ═══
async function fetchTweetsX(userId, h, max) {
  max = max || 5;
  var url = 'https://api.x.com/2/users/' + userId +
    '/tweets?max_results=' + max + '&tweet.fields=created_at';
  var r = await xFetch(url, h);
  if (!r.ok) {
    console.log('[x-reply] fetchTweetsX failed:', r.status, await r.text().then(function(t){return t.slice(0,200)}));
    return [];
  }
  var d = await r.json();
  return (d.data || []).map(function(t) {
    return {
      id: t.id,
      text: t.text || '',
      created_at: t.created_at || new Date().toISOString()
    };
  });
}

// ═══ X API v2: Fetch single tweet ═══
async function fetchTweetX(tweetId, h) {
  var url = 'https://api.x.com/2/tweets/' + tweetId + '?tweet.fields=created_at';
  var r = await xFetch(url, h);
  if (!r.ok) return null;
  var d = await r.json();
  if (!d.data) return null;
  return {
    id: d.data.id,
    text: d.data.text || '',
    created_at: d.data.created_at || new Date().toISOString()
  };
}

// ═══ Primary: Fetch tweet from URL ═══
async function FU(tu, h) {
  var ti = tu.split('/status/')[1] ? tu.split('/status/')[1].replace(/[^0-9]/g, '') : '';
  if (!ti) return null;

  // X API v2 first (Bearer Token → OAuth 1.0a)
  if ((h.bt || (h.ak && h.at))) {
    try {
      var t = await fetchTweetX(ti, h);
      if (t && t.text) return {
        id: t.id, text: t.text, created_at: t.created_at,
        url: tu, author: '', source: 'x-api-v2'
      };
    } catch(e) {}
  }

  // Fallback: FxTwitter
  try {
    var r = await fetch('https://api.fxtwitter.com/i/status/' + ti);
    if (r.ok) {
      var d = await r.json();
      if (d.tweet) {
        var auth = (d.tweet.author && d.tweet.author.screen_name) || '';
        return { id: d.tweet.id, text: d.tweet.text || '', created_at: d.tweet.created_at || new Date().toISOString(), url: d.tweet.url, author: auth, source: 'fxtwitter-direct' };
      }
    }
  } catch(e) {}

  return null;
}

// ═══ Primary: Fetch latest tweet from username ═══
async function FL(ta, h) {
  var xErr = '';

  // X API v2 first (Bearer Token → OAuth 1.0a)
  if (h.bt || (h.ak && h.at)) {
    try {
      var uid = await getUserId(ta, h);
      if (uid) {
        var tweets = await fetchTweetsX(uid, h, 3);
        if (tweets.length > 0) {
          var t = tweets[0];
          return {
            id: t.id, text: t.text, created_at: t.created_at,
            url: 'https://x.com/' + ta + '/status/' + t.id,
            author: ta, source: 'x-api-v2' + (h.bt ? '-bearer' : '-oauth1a')
          };
        }
      } else {
        xErr = 'user not found via X API';
      }
    } catch(e) { xErr = e.message; }
  }

  // Fallback: FxTwitter
  try {
    var r = await fetch('https://api.fxtwitter.com/' + ta + '/tweets');
    if (r.ok) {
      var d = await r.json();
      if (d.tweets && d.tweets.length) {
        var t = d.tweets[0];
        return { id: t.id, text: t.text || '', created_at: t.created_at || new Date().toISOString(), url: 'https://x.com/' + ta + '/status/' + t.id, author: ta, source: 'fxtwitter' };
      }
    }
  } catch(e) {}

  // Fallback: Nitter RSS
  var ni = ['https://nitter.net', 'https://nitter.privacydev.net'];
  for (var b of ni) {
    try {
      var rr = await fetch(b + '/' + ta + '/rss', { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (rr.ok) {
        var x = await rr.text();
        var im = x.match(/<item>([\s\S]*?)<\/item>/);
        if (im) {
          var i = im[1];
          var lk = (i.match(/<link>(.*?)<\/link>/) || [])[1] || '';
          var id = lk.split('/status/')[1] ? lk.split('/status/')[1].replace(/[^0-9]/g, '') : '0';
          var tx = ((i.match(/<title>(.*?)<\/title>/) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          var dt = (i.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || new Date().toISOString();
          if (tx) return { id: id, text: tx.slice(0, 500), created_at: new Date(dt).toISOString(), url: 'https://x.com/' + ta + '/status/' + id, author: ta, source: 'nitter' };
        }
      }
    } catch(e) { continue; }
  }

  return { error: xErr };
}

// ── Generate AI reply ──
async function GR(tt, an, ak) {
  if (!ak) return 'Nice post @' + an + '! 👏';
  try {
    var r = await fetch(AB + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ak },
      body: JSON.stringify({
        model: AM,
        messages: [
          { role: 'system', content: 'Kamu adalah social media assistant. Balas tweet dari @' + an + ' dengan reply engaging, singkat (max 250 char), natural seperti manusia. Bahasa Indonesia casual (gaul tapi sopan). JANGAN hashtag. JANGAN mention user lain.' },
          { role: 'user', content: 'Tweet dari @' + an + ':\n"' + tt + '"\n\nReply dengan 1-2 kalimat engaging:' }
        ],
        temperature: 0.85, max_tokens: 150
      })
    });
    var d = await r.json();
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || 'Setuju! 👏').trim().replace(/^"|"$/g, '').trim();
  } catch(e) {
    return 'Nice post @' + an + '! 👏';
  }
}

// ── Post reply to X (v2 → fallback v1.1) ──
async function PR(ti, tx, h) {
  var ua = { 'User-Agent': UA };
  var u2 = 'https://api.x.com/2/tweets';
  var r2 = await fetch(u2, {
    method: 'POST',
    headers: Object.assign({ 'Authorization': O('POST', u2, h), 'Content-Type': 'application/json' }, ua),
    body: JSON.stringify({ text: tx, reply: { in_reply_to_tweet_id: ti } })
  });
  if (r2.ok) { var d2 = await r2.json(); return { data: d2.data, via: 'v2' }; }
  var e2 = await r2.text();

  var u1 = 'https://api.twitter.com/1.1/statuses/update.json';
  var body1 = new URLSearchParams({ status: tx, in_reply_to_status_id: ti, auto_populate_reply_metadata: 'true' }).toString();
  var r1 = await fetch(u1, {
    method: 'POST',
    headers: Object.assign({ 'Authorization': O('POST', u1, h), 'Content-Type': 'application/x-www-form-urlencoded' }, ua),
    body: body1
  });
  if (r1.ok) { var d1 = await r1.json(); return { data: { id: d1.id_str || d1.id }, via: 'v1.1' }; }
  var e1 = await r1.text();
  throw new Error('Post failed. v2=' + r2.status + ' v1.1=' + r1.status + '. v2: ' + e2.slice(0,150) + ' | v1.1: ' + e1.slice(0,150));
}

// ═══════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, X-Api-Secret, X-Access-Token, X-Access-Secret, X-Bearer-Token, X-Agnes-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var u = new URL(req.url, 'http://localhost');
  var dr = u.searchParams.get('dry') === 'true';
  var tu = u.searchParams.get('tweet_url') || '';
  var ta = u.searchParams.get('target') || T;
  var h = H(req);

  // ── DEBUG ──
  if (u.searchParams.get('debug') === 'true') {
    var hasBearer = !!h.bt, hasOAuth = !!(h.ak && h.at), hasPost = !!(h.ak && h.at && h.as && h.ats);
    return res.json({
      status: 'debug', target: ta, version: '2.4',
      credentials: {
        X_API_KEY: h.ak ? h.ak.slice(0,8)+'...' : '❌ EMPTY',
        X_API_SECRET: h.as ? '✅ SET' : '❌ EMPTY',
        X_ACCESS_TOKEN: h.at ? h.at.slice(0,8)+'...' : '❌ EMPTY',
        X_ACCESS_SECRET: h.ats ? '✅ SET' : '❌ EMPTY',
        X_BEARER_TOKEN: h.bt ? h.bt.slice(0,10)+'...' : '❌ EMPTY (optional, untuk fetch tweet lebih reliable)',
        AGNES_KEY: h.ag ? h.ag.slice(0,8)+'...' : '❌ EMPTY'
      },
      can_fetch: hasBearer || hasOAuth,
      can_post: hasPost,
      fetch_method: hasBearer ? 'Bearer Token (OAuth 2.0)' : hasOAuth ? 'OAuth 1.0a (Bearer Token recommended)' : 'FxTwitter / Nitter (dead)',
      dry_run: dr,
      tip: !hasBearer && !hasOAuth ? '⚠️ No credentials. Set Bearer Token atau OAuth 1.0a di dashboard.' :
           !hasBearer && hasOAuth ? '💡 OAuth 1.0a ready tapi Bearer Token lebih reliable untuk fetch. Tambahkan X_BEARER_TOKEN.' :
           hasBearer && !hasPost ? '⚠️ Bearer Token OK untuk fetch, tapi perlu OAuth 1.0a untuk POST reply.' :
           '✅ All credentials OK! Fetch via Bearer Token, Post via OAuth 1.0a.'
    });
  }

  try {
    var tw;
    if (tu) {
      tw = await FU(tu, h);
      if (!tw) return res.json({ status: 'idle', message: 'Could not fetch tweet from URL: ' + tu, hint: 'Tweet mungkin sudah dihapus atau URL tidak valid.' });
      if (tw.author) ta = tw.author;
    } else {
      var result = await FL(ta, h);
      if (!result || result.error || !result.text) {
        var xErrMsg = (result && result.error) ? ' X API error: ' + result.error : '';
        return res.json({
          status: 'idle',
          message: 'No recent tweets from @' + ta + '.' + xErrMsg,
          hint: (!h.bt && !(h.ak && h.at))
            ? '💡 Isi Bearer Token (OAuth 2.0) di dashboard — paling reliable untuk fetch tweet.'
            : (!h.bt)
            ? '💡 OAuth 1.0a mungkin gagal fetch. Tambahkan Bearer Token untuk fetch yang lebih reliable.'
            : 'Akun ini mungkin belum pernah tweet, private, atau suspended.'
        });
      }
      tw = result;
    }

    var rt = await GR(tw.text, ta, h.ag);

    if (dr) {
      return res.json({ status: 'dry_run', tweet: { id: tw.id, text: tw.text.slice(0,200), created_at: tw.created_at }, reply: rt, message: 'Dry run — no post made', source: tw.source });
    }

    if (!h.ak || !h.at) {
      return res.json({ status: 'no_credentials', tweet: { id: tw.id, text: tw.text.slice(0,200), created_at: tw.created_at }, reply: rt, message: '⚠️ AI reply generated but OAuth 1.0a credentials missing. Isi kredensial di dashboard untuk posting.', source: tw.source });
    }

    var po = await PR(tw.id, rt, h);
    return res.json({ status: 'replied', tweet: { id: tw.id, text: tw.text.slice(0,200), created_at: tw.created_at }, reply: rt, reply_id: po.data && po.data.id, url: tw.url || 'https://x.com/' + ta + '/status/' + tw.id, source: tw.source + ' + x-api-' + (po.via || 'v2') });

  } catch(err) {
    return res.status(500).json({ status: 'error', error: err.message, hint: err.message.includes('401') ? '🔑 401 — cek OAuth 1.0a credentials & pastikan X App ter-attach ke Project.' : err.message.includes('403') ? '🚫 403 — X App perlu permission "Read and Write".' : 'Coba ?debug=true untuk cek status.' });
  }
}
