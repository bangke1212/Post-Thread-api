// netlify/functions/manual.js — Manual pipeline trigger for Netlify
const { getConfig } = require('./config.js');
const { runPipeline } = require('./pipeline.js');
const { RunLockError } = require('./errors.js');
const { logger } = require('./logger.js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed. Use POST.' }) };
  }

  const dryRun = req.query['dry'] === 'true';
  logger.info('Manual pipeline triggered', { dryRun });

  try {
    const config = getConfig();
    const result = await runPipeline(config, dryRun);
    return { statusCode: 200, body: JSON.stringify({
      status: result.status,
      postId: result.postId,
      generatedText: result.generatedText,
      error: result.error,
    }) };
  } catch (err) {
    if (err instanceof RunLockError) {
      return { statusCode: 200, body: JSON.stringify({ status: 'skipped', error: 'Pipeline already running' }) };
    }
    logger.critical('Manual pipeline exception', { error: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
