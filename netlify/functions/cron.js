// netlify/functions/cron.js
import { getConfig } from './config.js';
import { runPipeline } from './pipeline.js';
import { logger } from './logger.js';
import { RunLockError } from './errors.js';

export default async (req) => {
  logger.info('Cron triggered');
  
  try {
    const config = getConfig();
    const result = await runPipeline(config);

    return new Response(JSON.stringify(result), {
      status: result.status === 'error' ? 500 : 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    if (err instanceof RunLockError) {
      return new Response(JSON.stringify({ status: 'locked', message: err.message }), { status: 409 });
    }
    logger.error('Cron failed', { error: err.message });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config = { schedule: '15 5,12 * * *' };
