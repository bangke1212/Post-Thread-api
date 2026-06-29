exports.handler = async (event, context) => {
  return { 
    statusCode: 200, 
    body: JSON.stringify({ 
      ok: true, 
      msg: 'Netlify functions working v2!',
      env: {
        hasThreadsAppId: !!process.env.THREADS_APP_ID,
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        redirectUri: process.env.THREADS_REDIRECT_URI || 'NOT SET'
      }
    }) 
  };
};
