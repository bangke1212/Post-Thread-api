// netlify/functions/cron.js — supports Agnes, Mistral, and IAMHC
import { runPipeline } from './pipeline.js';
import { logger } from './logger.js';

export default async (req) => {
  // AI Provider: AI_PROVIDER=iamhc|mistral|agnes (default agnes)
  const aiProvider = process.env.AI_PROVIDER || 'agnes';

  // Get API key based on provider
  let apiKey;
  if (aiProvider === 'iamhc') {
    apiKey = process.env.IAMHC_API_KEY;
  } else if (aiProvider === 'mistral') {
    apiKey = process.env.MISTRAL_API_KEY;
  } else {
    apiKey = process.env.OPENROUTER_API_KEY || process.env.AGNES_API_KEY;
  }

  if (!apiKey) {
    logger.warn('Cron skipped: no API key for ' + aiProvider);
    return new Response(JSON.stringify({ status: 'skipped', error: 'Missing API key for ' + aiProvider }), 
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const config = {
      aiProvider,
      openrouterApiKey: apiKey,
      mistralApiKey: apiKey,
      iamhcApiKey: apiKey,
      openrouterModel: 'agnes-2.0-flash',
      mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
      iamhcModel: process.env.IAMHC_MODEL || 'auto',
      threadsAppId: process.env.THREADS_APP_ID || 'dashboard',
      threadsAccessToken: process.env.THREADS_ACCESS_TOKEN || '',
      searchQueries: ['trending','teknologi','bisnis','startup','motivasi','AI','inspirasi'],
      dbDir: process.env.DB_DIR || '/tmp',
    };

    logger.info('Cron triggered', { provider: aiProvider, model: config.iamhcModel || config.mistralModel || config.openrouterModel });
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
