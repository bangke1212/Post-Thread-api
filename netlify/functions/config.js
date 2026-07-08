// netlify/functions/config.js — shared config helper
export function getConfig() {
  // ── Agnes ────────────────────────
  const agnesApiKey = process.env['OPENROUTER_API_KEY'] || process.env['AGNES_API_KEY'];

  // ── Mistral ──────────────────────
  const mistralApiKey = process.env['MISTRAL_API_KEY'] || '';

  // ── IAMHC (幻城网安) ─────────────
  const iamhcApiKey = process.env['IAMHC_API_KEY'] || '';

  // ── AI Provider priority ─────────
  const aiProvider = process.env['AI_PROVIDER'] || 'agnes';

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
    // Agnes
    openrouterApiKey: agnesApiKey,
    openrouterModel: 'agnes-2.0-flash',
    // Mistral
    mistralApiKey,
    mistralModel: process.env['MISTRAL_MODEL'] || 'mistral-small-latest',
    // IAMHC (幻城网安)
    iamhcApiKey,
    iamhcModel: process.env['IAMHC_MODEL'] || 'auto',
    // General
    aiProvider,
    searchQueries,
    dbDir: process.env.DB_DIR || '/tmp',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
