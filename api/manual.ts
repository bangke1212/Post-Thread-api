// api/manual.ts — Manual pipeline trigger endpoint
// POST /api/manual — triggers a pipeline run immediately
// POST /api/manual?dry=true — dry run (no publish)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from '../src/config.js';
import { runPipeline } from '../src/pipeline.js';
import { RunLockError } from '../src/errors.js';
import { logger } from '../src/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    logger.critical('Manual pipeline exception', { error: (err as Error).message });
    return res.status(500).json({ error: (err as Error).message });
  }
}
