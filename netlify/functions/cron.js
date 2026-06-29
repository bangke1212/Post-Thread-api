exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      node: process.version,
      dir: __dirname,
      env_keys: Object.keys(process.env).filter(k => k.startsWith('THREADS') || k.startsWith('OPENROUTER'))
    })
  };
};
