// netlify/functions/config.js
export function getConfig() {
  const apiKey = process.env['OPENROUTER_API_KEY'] || process.env['AGNES_API_KEY'];
  const model = 'agnes-2.0-flash';
  
  if (!apiKey) throw new Error('Missing API key (set OPENROUTER_API_KEY or AGNES_API_KEY)');
  
  let searchQueries = ['trending', 'teknologi', 'bisnis', 'startup', 'motivasi', 'AI', 'inspirasi'];
  try {
    if (process.env.SEARCH_QUERIES) {
      searchQueries = JSON.parse(process.env.SEARCH_QUERIES);
    }
  } catch {}
  
  return {
    threadsAppId: process.env['THREADS_APP_ID'],
    threadsAppSecret: process.env['THREADS_APP_SECRET'],
    threadsRedirectUri: process.env['THREADS_REDIRECT_URI'],
    threadsAccessToken: process.env['THREADS_ACCESS_TOKEN'],
    openrouterApiKey: apiKey,
    openrouterModel: model,
    searchQueries,
    dbDir: process.env.DB_DIR || '/tmp',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
