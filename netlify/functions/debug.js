export default async () => {
  return new Response(JSON.stringify({
    env: {
      hasAppId: !!process.env.THREADS_APP_ID,
      hasSecret: !!process.env.THREADS_APP_SECRET,
      hasToken: !!process.env.THREADS_ACCESS_TOKEN,
      hasApiKey: !!(process.env.OPENROUTER_API_KEY || process.env.AGNES_API_KEY),
      model: 'agnes-2.0-flash',
    }
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
