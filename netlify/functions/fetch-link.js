// Proxy for fetching link content server-side (no CORS)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function fetchContent(url) {
  let fetchUrl = url;
  let useJsonApi = false;
  try {
    const u = new URL(url);
    if (u.hostname === 'x.com' || u.hostname === 'twitter.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      const tweetId = parts[parts.indexOf('status') + 1] || parts[0];
      if (tweetId && /^\d+$/.test(tweetId)) {
        fetchUrl = `https://api.fxtwitter.com/status/${tweetId}`;
        useJsonApi = true;
      }
    }
  } catch(e) {}

  const res = await fetch(fetchUrl);
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

  if (useJsonApi) {
    const json = await res.json();
    const tweet = json.tweet || json;
    return { ok: true, content: tweet.text || json.text || '', author: tweet.author?.name || '', source: 'fxtwitter-api' };
  }

  const raw = await res.text();
  const ogDesc = raw.match(/<meta[^>]*og:description[^>]*content="([^"]*)"/);
  const ogTitle = raw.match(/<meta[^>]*og:title[^>]*content="([^"]*)"/);
  let content = '';
  if (ogDesc) {
    content = (ogTitle ? ogTitle[1].replace(/ on X$/, '') + ': ' : '') + ogDesc[1];
    content = content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
  } else {
    content = raw.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
  }
  return { ok: true, content, source: 'html-parse' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  }
  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'No URL' }) };
    const result = await fetchContent(url);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch(e) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
