// netlify/functions/config.js
export function getConfig() {
  const appId = process.env['THREADS_APP_ID'];
  const appSecret = process.env['THREADS_APP_SECRET'];
  const redirectUri = process.env['THREADS_REDIRECT_URI'];
  const openrouterKey = process.env['OPENROUTER_API_KEY'];
  const model = process.env['OPENROUTER_MODEL'] || 'google/gemini-2.5-flash';
  
  if (!appId) throw new Error('Missing THREADS_APP_ID env var');
  if (!appSecret) throw new Error('Missing THREADS_APP_SECRET env var');
  if (!openrouterKey) throw new Error('Missing OPENROUTER_API_KEY env var');
  
  let searchQueries = ['trending', 'viral', 'tech', 'startup', 'developer', 'inspirasi'];
  try {
    if (process.env.SEARCH_QUERIES) {
      searchQueries = JSON.parse(process.env.SEARCH_QUERIES);
    }
  } catch {}
  
  return {
    threadsAppId: appId,
    threadsAppSecret: appSecret,
    threadsRedirectUri: redirectUri,
    openrouterApiKey: openrouterKey,
    openrouterModel: model,
    searchQueries,
    dbDir: process.env.DB_DIR || '/tmp',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
