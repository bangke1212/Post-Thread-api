// api/cron.cjs — Vercel Cron Job handler
const { getConfig } = require('./config.js');
const { runPipeline } = require('./pipeline.js');
const { RunLockError } = require('./errors.js');
const { logger } = require('./logger.js');

exports.handler = async (event, context) => {
  logger.info('Cron job triggered');

  try {
    const config = getConfig();
    const result = await runPipeline(config);

    if (result.status === 'success') {
      return { statusCode: 200, body: JSON.stringify({ status: 'ok', postId: result.postId, text: result.generatedText }) };
    } else if (result.status === 'skipped') {
      return { statusCode: 200, body: JSON.stringify({ status: 'skipped', error: result.error }) };
    } else {
      return { statusCode: 500, body: JSON.stringify({ error: result.error }) };
    }
  } catch (err) {
    if (err instanceof RunLockError) {
      return { statusCode: 200, body: JSON.stringify({ status: 'skipped', error: 'Pipeline already running' }) };
    }
    logger.critical('Cron pipeline exception', { error: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
