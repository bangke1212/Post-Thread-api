// Proxy for fetching tweet content + images server-side (no CORS)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function fetchContent(url) {
  let fetchUrl = url;
  let useJsonApi = false;
  let tweetId = '';
  try {
    const u = new URL(url);
    if (u.hostname === 'x.com' || u.hostname === 'twitter.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      tweetId = parts[parts.indexOf('status') + 1] || parts[0];
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
    
    // Extract media URLs (images + video thumbs)
    let images = [];
    if (tweet.media?.photos) {
      images = tweet.media.photos.map(p => p.url || p.direct_url).filter(Boolean);
    }
    // Also check media.all for videos
    if (tweet.media?.videos) {
      tweet.media.videos.forEach(v => {
        if (v.thumbnail_url) images.push(v.thumbnail_url);
      });
    }
    // Fallback: if tweet has media_extracted
    if (tweet.media_extended) {
      tweet.media_extended.forEach(m => {
        if (m.type === 'photo' && m.url) images.push(m.url);
        if ((m.type === 'video' || m.type === 'gif') && m.thumbnail_url) images.push(m.thumbnail_url);
      });
    }
    
    return { 
      ok: true, 
      content: tweet.text || json.text || '', 
      author: tweet.author?.name || '', 
      source: 'fxtwitter-api',
      images: images.slice(0, 4), // max 4 images
      hasMedia: images.length > 0
    };
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
  return { ok: true, content, source: 'html-parse', images: [], hasMedia: false };
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
