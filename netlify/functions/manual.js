// netlify/functions/manual.js — Manual post trigger for Netlify
const path = require('path');
const { getConfig } = require(path.join(__dirname, 'config.js'));
const { runPipeline } = require(path.join(__dirname, 'pipeline.js'));
const { logger } = require(path.join(__dirname, 'logger.js'));

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
    };
  }

  const dryRun = event.queryStringParameters ? event.queryStringParameters['dry'] === 'true' : false;

  try {
    const config = getConfig();
    const result = await runPipeline(config, { dryRun });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: result.status,
        postId: result.postId,
        text: result.generatedText,
        dryRun,
      }),
    };
  } catch (err) {
    logger.error('Manual trigger failed', { error: err.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
