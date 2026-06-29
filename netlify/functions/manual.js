// netlify/functions/manual.js
import { runPipeline } from './pipeline.js';
import { logger } from './logger.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry') === 'true';
  
  // Get API key from header (dashboard sends X-Api-Key)
  const apiKey = req.headers.get('X-Api-Key') || process.env.OPENROUTER_API_KEY || process.env.AGNES_API_KEY;
  const topic = req.headers.get('X-Topic') || 'trending topic';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key. Set in dashboard or env vars.' }), { status: 401 });
  }

  try {
    const config = {
      openrouterApiKey: apiKey,
      openrouterModel: process.env.OPENROUTER_MODEL || 'Agnes-2.0-Flash',
      threadsAppId: process.env.THREADS_APP_ID,
      threadsAppSecret: process.env.THREADS_APP_SECRET,
      threadsAccessToken: process.env.THREADS_ACCESS_TOKEN,
      searchQueries: [topic],
      dbDir: process.env.DB_DIR || '/tmp',
    };

    logger.info('Manual trigger', { dryRun, topic });
    const result = await runPipeline(config, { dryRun });

    return new Response(JSON.stringify(result), {
      status: result.status === 'error' ? 500 : 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    logger.error('Manual failed', { error: err.message });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
