// netlify/functions/manual.js
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
  
  // Get API key — priority: header > env vars
  const apiKey = req.headers.get('X-Api-Key') || 
                  req.headers.get('x-api-key') ||
                  process.env.OPENROUTER_API_KEY || 
                  process.env.AGNES_API_KEY;
    const topic = (() => {
    try { const b = JSON.parse(body); return b.topic || 'trending topic'; } 
    catch { return 'trending topic'; }
  })();
  const tone = (() => {
    try { const b = JSON.parse(body); return b.tone || ''; } 
    catch { return ''; }
  })();
  const link = (() => {
    try { const b = JSON.parse(body); return b.link || ''; } 
    catch { return ''; }
  })();

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key. Paste your Agnes AI key in the dashboard input above, or set OPENROUTER_API_KEY env var.' }), 
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    // Build config langsung — BYPASS config.js
    const config = {
      openrouterApiKey: apiKey,
      openrouterModel: 'agnes-2.0-flash',
      tone: tone,
      link: link,
      threadsAppId: process.env.THREADS_APP_ID || 'dashboard',
      threadsAccessToken: process.env.THREADS_ACCESS_TOKEN || '',
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
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    });
  }
};
