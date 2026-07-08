// Fetch-link proxy — pake fxtwitter API (gratis, no auth)
export default async function handler(req) {
  const url = req.query.url;
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing url' }) };
  }

  // Convert ke fxtwitter API
  let fxUrl = url
    .replace(/https?:\/\/(x\.com|twitter\.com)/i, 'https://api.fxtwitter.com')
    .replace(/https?:\/\/(fx?twitter\.com)/i, 'https://api.fxtwitter.com');

  try {
    const r = await fetch(fxUrl, {
      headers: { 'User-Agent': 'TelegramBot' }
    });
    
    if (!r.ok) throw new Error('fxtwitter API returned ' + r.status);
    
    const data = await r.json();
    const tweet = data.tweet;
    
    if (!tweet || !tweet.text) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Tweet not found' }) };
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        text: tweet.text,
        author: tweet.author?.screen_name || tweet.author?.name || '',
        images: (tweet.media?.photos || []).map(p => p.url),
        hasMedia: !!tweet.media
      })
    };
  } catch (e) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: e.message }) 
    };
  }
}
