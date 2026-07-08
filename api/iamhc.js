// api/iamhc.js — POST /api/iamhc — Generate + post ke Threads via IAMHC (幻城网安)
import { runPipelineIAMHC } from '../netlify/functions/pipeline.js';
import { IAMHC_MODELS } from '../netlify/functions/iamhc.js';
import { logger } from '../netlify/functions/logger.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // GET /api/iamhc — return model list
  if (req.method === 'GET') {
    return res.status(200).json({
      provider: 'IAMHC (幻城网安)',
      endpoint: 'https://api.iamhc.cn/v1',
      models: IAMHC_MODELS.recommended,
      allModelIds: IAMHC_MODELS.all,
      rateLimit: IAMHC_MODELS.rateLimit,
      docs: IAMHC_MODELS.docs,
      signup: IAMHC_MODELS.signup,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST or GET only' });
  }

  const url = new URL(req.url, 'http://localhost');
  const dryRun = url.searchParams.get('dry') === 'true';

  // Get IAMHC API key
  const apiKey = (req.body?.iamhcApiKey) ||
                  req.headers['x-api-key'] ||
                  process.env.IAMHC_API_KEY;

  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Missing IAMHC API key. Get one at https://api.iamhc.cn then set IAMHC_API_KEY env var or pass X-Api-Key header.',
      docs: 'https://api.iamhc.cn',
      signup: 'https://api.iamhc.cn',
    });
  }

  const topic = req.body?.topic || 'trending topic';
  const tone = req.body?.tone || '';
  const lang = req.body?.lang || 'id';
  const linkContent = req.body?.linkContent || '';
  const model = req.body?.model || process.env.IAMHC_MODEL || 'auto';

  try {
    const config = {
      iamhcApiKey: apiKey,
      iamhcModel: model,
      tone,
      lang,
      linkContent,
      threadsAppId: process.env.THREADS_APP_ID || 'dashboard',
      threadsAccessToken: process.env.THREADS_ACCESS_TOKEN || '',
      searchQueries: [topic],
      dbDir: process.env.DB_DIR || '/tmp',
    };

    logger.info('[IAMHC] Manual trigger', { dryRun, topic, lang, model });
    const result = await runPipelineIAMHC(config, { dryRun });

    return res.status(result.status === 'error' ? 500 : 200).json(result);
  } catch (err) {
    logger.error('[IAMHC] Failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
