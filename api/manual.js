// api/manual.js — Manual pipeline trigger endpoint

import { getConfig } from '../dist/config.js';
import { runPipeline } from '../dist/pipeline.js';
import { RunLockError } from '../dist/errors.js';
import { logger } from '../dist/logger.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const dryRun = req.query['dry'] === 'true';
  logger.info('Manual pipeline triggered', { dryRun });

  try {
    const config = getConfig();
    const result = await runPipeline(config, dryRun);

    return res.status(200).json({
      status: result.status,
      postId: result.postId,
      generatedText: result.generatedText,
      error: result.error,
    });
  } catch (err) {
    if (err instanceof RunLockError) {
      return res.status(200).json({ status: 'skipped', error: 'Pipeline already running' });
    }
    logger.critical('Manual pipeline exception', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
