// api/agnes.js — POST /api/agnes — Generate + post ke Threads via Agnes AI
import { runPipelineAgnes } from '../netlify/functions/pipeline.js';
import { logger } from '../netlify/functions/logger.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'POST or GET only' });
  }

  const url = new URL(req.url, 'http://localhost');
  const dryRun = url.searchParams.get('dry') === 'true';

  // Get Agnes API key
  const apiKey = (req.body?.agnesApiKey) ||
                  req.headers['x-api-key'] ||
                  process.env.OPENROUTER_API_KEY ||
                  process.env.AGNES_API_KEY;

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing Agnes API key. Set OPENROUTER_API_KEY env var or pass X-Api-Key header.' });
  }

  const topic = req.body?.topic || 'trending topic';
  const tone = req.body?.tone || '';
  const lang = req.body?.lang || 'id';
  const linkContent = req.body?.linkContent || '';

  try {
    const config = {
      openrouterApiKey: apiKey,
      openrouterModel: 'agnes-2.0-flash',
      tone,
      lang,
      linkContent,
      threadsAppId: process.env.THREADS_APP_ID || 'dashboard',
      threadsAccessToken: process.env.THREADS_ACCESS_TOKEN || '',
      searchQueries: [topic],
      dbDir: process.env.DB_DIR || '/tmp',
    };

    logger.info('[Agnes] Manual trigger', { dryRun, topic, lang });
    const result = await runPipelineAgnes(config, { dryRun });

    return res.status(result.status === 'error' ? 500 : 200).json(result);
  } catch (err) {
    logger.error('[Agnes] Failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
