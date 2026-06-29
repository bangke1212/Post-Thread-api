// api/cron.cjs — Vercel Cron Job handler
const { getConfig } = require('./lib/config.js');
const { runPipeline } = require('./lib/pipeline.js');
const { RunLockError } = require('./lib/errors.js');
const { logger } = require('./lib/logger.js');

module.exports = async function handler(req, res) {
  logger.info('Cron job triggered');

  try {
    const config = getConfig();
    const result = await runPipeline(config);

    if (result.status === 'success') {
      return res.status(200).json({ status: 'ok', postId: result.postId, text: result.generatedText });
    } else if (result.status === 'skipped') {
      return res.status(200).json({ status: 'skipped', error: result.error });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (err) {
    if (err instanceof RunLockError) {
      return res.status(200).json({ status: 'skipped', error: 'Pipeline already running' });
    }
    logger.critical('Cron pipeline exception', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
