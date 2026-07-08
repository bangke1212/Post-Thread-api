// netlify/functions/manual.js — supports Agnes, Mistral, IAMHC
import { runPipeline } from './pipeline.js';
import { logger } from './logger.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const url = new URL(req.url);
  let body = '';
  try { body = await req.clone().text(); } catch {}
  const dryRun = url.searchParams.get('dry') === 'true';
  
  // Parse body
  let parsed = {};
  try { parsed = JSON.parse(body); } catch {}

  const aiProvider = parsed.provider || process.env.AI_PROVIDER || 'agnes';
  const topic = parsed.topic || 'trending topic';
  const tone = parsed.tone || '';
  const lang = parsed.lang || 'id';
  const linkContent = parsed.linkContent || '';

  // Get API key based on provider
  let apiKey;
  if (aiProvider === 'iamhc') {
    apiKey = req.headers.get('X-Api-Key') || req.headers.get('x-api-key') || process.env.IAMHC_API_KEY;
  } else if (aiProvider === 'mistral') {
    apiKey = req.headers.get('X-Api-Key') || req.headers.get('x-api-key') || process.env.MISTRAL_API_KEY;
  } else {
    apiKey = req.headers.get('X-Api-Key') || req.headers.get('x-api-key') || process.env.OPENROUTER_API_KEY || process.env.AGNES_API_KEY;
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key. Set ' + (aiProvider === 'iamhc' ? 'IAMHC_API_KEY' : aiProvider === 'mistral' ? 'MISTRAL_API_KEY' : 'OPENROUTER_API_KEY/AGNES_API_KEY') + ' env var or pass X-Api-Key header.' }), 
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const config = {
      aiProvider,
      openrouterApiKey: apiKey,
      mistralApiKey: apiKey,
      iamhcApiKey: apiKey,
      openrouterModel: 'agnes-2.0-flash',
      mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
      iamhcModel: parsed.model || process.env.IAMHC_MODEL || 'auto',
      tone,
      lang,
      linkContent,
      threadsAppId: process.env.THREADS_APP_ID || 'dashboard',
      threadsAccessToken: process.env.THREADS_ACCESS_TOKEN || '',
      searchQueries: [topic],
      dbDir: process.env.DB_DIR || '/tmp',
    };

    logger.info('Manual trigger', { dryRun, topic, provider: aiProvider, model: config.iamhcModel || config.mistralModel || config.openrouterModel });
    const result = await runPipeline(config, { dryRun });

    return new Response(JSON.stringify(result), {
      status: result.status === 'error' ? 500 : 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    logger.error('Manual failed', { error: err.message });
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    });
  }
};
