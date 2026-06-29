// api/cron.ts — Vercel Cron Job handler
// Triggered by vercel.json cron schedule (05:15 and 12:30 UTC = 12:15 and 19:30 WIB)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from '../src/config.js';
import { runPipeline } from '../src/pipeline.js';
import { RunLockError } from '../src/errors.js';
import { logger } from '../src/logger.js';

// Load .env manually in Vercel dev (env vars are injected by Vercel dashboard in production)
try {
  const { readFileSync } = await import('fs');
  const envFile = readFileSync('.env', 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // No .env file — that's fine in production (env vars from Vercel dashboard)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret if configured
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
      logger.info('Cron pipeline success', { postId: result.postId });
      return res.status(200).json({ status: 'ok', postId: result.postId, text: result.generatedText });
    } else if (result.status === 'skipped') {
      logger.warn('Cron pipeline skipped', { error: result.error });
      return res.status(200).json({ status: 'skipped', error: result.error });
    } else {
      logger.error('Cron pipeline failed', { error: result.error });
      return res.status(500).json({ error: result.error });
    }
  } catch (err) {
    if (err instanceof RunLockError) {
      return res.status(200).json({ status: 'skipped', error: 'Pipeline already running' });
    }
    logger.critical('Cron pipeline exception', { error: (err as Error).message });
    return res.status(500).json({ error: (err as Error).message });
  }
}
