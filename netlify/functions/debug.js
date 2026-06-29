// netlify/functions/debug.js
export default async () => {
  const env = {
    hasAppId: !!process.env.THREADS_APP_ID,
    hasAppSecret: !!process.env.THREADS_APP_SECRET,
    hasAccessToken: !!process.env.THREADS_ACCESS_TOKEN,
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    hasOpenRouterModel: !!process.env.OPENROUTER_MODEL,
    hasSearchQueries: !!process.env.SEARCH_QUERIES,
    hasRedirectUri: !!process.env.THREADS_REDIRECT_URI,
    redirectUri: process.env.THREADS_REDIRECT_URI || 'NOT SET',
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
  };

  return new Response(JSON.stringify(env), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
