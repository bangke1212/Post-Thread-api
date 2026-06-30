// Proxy Multi-Fallback Tweet Reader
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchContent(url) {
  let tweetId = '';
  try {
    const u = new URL(url);
    if (u.hostname === 'x.com' || u.hostname === 'twitter.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      let idx = parts.indexOf('status');
      tweetId = idx >= 0 ? parts[idx + 1] : parts[0];
      if (tweetId && tweetId.includes('?')) tweetId = tweetId.split('?')[0];
    }
  } catch(e) {}
  
  console.log('Extracted tweetId:', tweetId);

  // 1. Try fxtwitter
  try {
    if (tweetId) {
      const fxUrl = 'https://api.fxtwitter.com/status/' + tweetId;
      const res = await fetchWithTimeout(fxUrl, 8000);
      if (res.ok) {
        const data = await res.json();
        if (data.tweet && data.tweet.text) {
          const imgs = (data.tweet.media && data.tweet.media.photos || []).map(p => p.url);
          return { ok: true, text: data.tweet.text, images: imgs, author: (data.tweet.author && data.tweet.author.screen_name) || '', source: 'fxtwitter' };
        }
      }
    }
  } catch(e) { console.log('fxtwitter err:', e.message); }

  // 2. Try nitter
  try {
    if (tweetId) {
      const nitterUrl = 'https://nitter.net/_/' + tweetId + '/rss';
      const res = await fetchWithTimeout(nitterUrl, 8000);
      if (res.ok) {
        const text = await res.text();
        const m = text.match(/<title>(.+?)<\/title>/);
        if (m) return { ok: true, text: m[1].replace(/^@\w+\s*:\s*/, '').trim(), images: [], source: 'nitter' };
      }
    }
  } catch(e) { console.log('nitter err:', e.message); }

  // 3. Try direct fetch
  try {
    const res = await fetchWithTimeout(url, 8000);
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/<title>(.+?)<\/title>/);
      if (m) return { ok: true, text: m[1], images: [], source: 'direct' };
      return { ok: true, text: html.slice(0, 1000), images: [], source: 'direct' };
    }
  } catch(e) { console.log('direct err:', e.message); }

  return { ok: false, error: 'Semua sumber gagal. Coba paste teks manual atau link lain.' };
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers });
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok: false, error: 'URL kosong' }), { status: 400, headers });
    const result = await fetchContent(url);
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
};
