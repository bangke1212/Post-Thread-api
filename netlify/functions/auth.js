exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      hasAppId: !!process.env.THREADS_APP_ID,
      hasAppSecret: !!process.env.THREADS_APP_SECRET,
      redirectUri: process.env.THREADS_REDIRECT_URI || '(default)'
    })
  };
};
