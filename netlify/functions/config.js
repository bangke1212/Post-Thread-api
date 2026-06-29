export function getConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AGNES_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'Agnes-2.0-Flash';
  if (!apiKey) throw new Error('Missing API key');

  let queries = ['trending','teknologi','bisnis','startup','motivasi','AI','inspirasi'];
  try { if (process.env.SEARCH_QUERIES) queries = JSON.parse(process.env.SEARCH_QUERIES); } catch {}

  return {
    threadsAppId: process.env.THREADS_APP_ID,
    threadsAppSecret: process.env.THREADS_APP_SECRET,
    threadsRedirectUri: process.env.THREADS_REDIRECT_URI,
    threadsAccessToken: process.env.THREADS_ACCESS_TOKEN,
    openrouterApiKey: apiKey,
    openrouterModel: model,
    searchQueries: queries,
    dbDir: process.env.DB_DIR || '/tmp',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
