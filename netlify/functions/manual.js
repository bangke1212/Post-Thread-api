// netlify/functions/manual.js
import { getConfig } from './config.js';
import { runPipeline } from './pipeline.js';
import { logger } from './logger.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry') === 'true';

  try {
    logger.info('Manual trigger', { dryRun });
    const config = getConfig();
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
