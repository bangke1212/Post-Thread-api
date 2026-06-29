// netlify/functions/cron.js — Scheduled post generator for Netlify
const path = require('path');
const { getConfig } = require(path.join(__dirname, 'config.js'));
const { runPipeline } = require(path.join(__dirname, 'pipeline.js'));
const { RunLockError } = require(path.join(__dirname, 'errors.js'));
const { logger } = require(path.join(__dirname, 'logger.js'));

exports.handler = async (event, context) => {
  logger.info('Cron job triggered');

  try {
    const config = getConfig();
    const result = await runPipeline(config);

    if (result.status === 'success') {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', postId: result.postId, text: result.generatedText }),
      };
    }
    if (result.status === 'no_action') {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'no_action', message: result.message || 'No post needed' }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', error: result.error }),
    };
  } catch (err) {
    if (err instanceof RunLockError) {
      return {
        statusCode: 409,
        body: JSON.stringify({ status: 'locked', message: 'Another instance is already running' }),
      };
    }
    logger.error('Cron failed', { error: err.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', error: err.message }),
    };
  }
};
