// netlify/functions/cron.js
import { runPipeline } from './pipeline.js';
import { logger } from './logger.js';

export default async (req) => {
  // Get API key — priority: header > env vars
  const apiKey = req?.headers?.get?.('X-Api-Key') || 
                  req?.headers?.get?.('x-api-key') ||
                  process.env.OPENROUTER_API_KEY || 
                  process.env.AGNES_API_KEY;

  if (!apiKey) {
    logger.warn('Cron skipped: no API key');
    return new Response(JSON.stringify({ status: 'skipped', error: 'Missing API key (set OPENROUTER_API_KEY or AGNES_API_KEY)' }), 
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const config = {
      openrouterApiKey: apiKey,
      openrouterModel: 'agnes-2.0-flash',
      threadsAppId: process.env.THREADS_APP_ID || 'dashboard',
      threadsAccessToken: process.env.THREADS_ACCESS_TOKEN || '',
      searchQueries: ['trending','teknologi','bisnis','startup','motivasi','AI','inspirasi'],
      dbDir: process.env.DB_DIR || '/tmp',
    };

    logger.info('Cron triggered');
    const result = await runPipeline(config, { dryRun: false });
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    logger.error('Cron failed', { error: err.message });
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    });
  }
};
