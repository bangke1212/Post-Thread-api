// Simple tweet reader using fxtwitter with retry
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function readTweet(url) {
  // Extract tweet ID
  let tweetId = '';
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('status');
    tweetId = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1];
    tweetId = (tweetId || '').split('?')[0].split('#')[0];
  } catch(e) {}

  if (!tweetId || !/^\d{15,25}$/.test(tweetId)) {
    return { ok: false, error: 'Link Twitter tidak valid. Pastikan format: x.com/user/status/123456...' };
  }

  // Try fxtwitter (works for most tweets)
  try {
    const r = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: { 'User-Agent': 'TelegramBot/1.0' }
    });
    if (r.ok) {
      const d = await r.json();
      if (d.tweet && d.tweet.text) {
        const photos = (d.tweet.media?.photos || []).map(p => p.url || '');
        const videos = (d.tweet.media?.videos || []).map(v => v.thumbnail_url || '');
        return {
          ok: true,
          content: d.tweet.text,
          author: d.tweet.author?.screen_name || d.tweet.author?.name || '',
          images: [...photos, ...videos],
          hasMedia: photos.length > 0 || videos.length > 0,
        };
      }
    }
    console.log('fxtwitter status:', r.status);
  } catch(e) { console.log('fxtwitter err:', e.message); }

  // If fxtwitter fails, it's usually a nonexistent tweet
  return { ok: false, error: `Tweet ${tweetId} tidak ditemukan. Mungkin private/delete. Coba paste teks manual.` };
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok: false, error: 'URL kosong' }), { status: 400, headers });
    const result = await readTweet(url);
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
};
