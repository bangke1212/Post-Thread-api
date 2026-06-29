exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      hasAppId: !!process.env.THREADS_APP_ID,
      hasAppSecret: !!process.env.THREADS_APP_SECRET,
      hasRedirectUri: !!process.env.THREADS_REDIRECT_URI,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasOpenRouterModel: !!process.env.OPENROUTER_MODEL,
      hasSearchQueries: !!process.env.SEARCH_QUERIES,
      hasDbDir: !!process.env.DB_DIR,
      hasLogLevel: !!process.env.LOG_LEVEL,
      redirectUri: process.env.THREADS_REDIRECT_URI || 'NOT SET'
    })
  };
};
