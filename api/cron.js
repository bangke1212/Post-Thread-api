// api/cron.js — Vercel Cron Job handler

import { getConfig } from '../dist/config.js';
import { runPipeline } from '../dist/pipeline.js';
import { RunLockError } from '../dist/errors.js';
import { logger } from '../dist/logger.js';

export default async function handler(req, res) {
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer ' + cronSecret) {
      logger.warn('Cron unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

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
