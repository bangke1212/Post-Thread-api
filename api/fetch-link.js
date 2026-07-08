// Vercel serverless — fxtwitter API proxy
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let fxUrl = url
    .replace(/https?:\/\/(x\.com|twitter\.com)/i, 'https://api.fxtwitter.com')
    .replace(/https?:\/\/(fx?twitter\.com)/i, 'https://api.fxtwitter.com');

  try {
    const r = await fetch(fxUrl, { headers: { 'User-Agent': 'TelegramBot' } });
    if (!r.ok) throw new Error('fxtwitter API returned ' + r.status);
    const data = await r.json();
    const tweet = data.tweet;
    if (!tweet || !tweet.text) return res.status(404).json({ error: 'Tweet not found' });
    
    res.status(200).json({
      text: tweet.text,
      author: tweet.author?.screen_name || tweet.author?.name || '',
      images: (tweet.media?.photos || []).map(p => p.url),
      hasMedia: !!tweet.media
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
