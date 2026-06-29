// netlify/functions/pipeline.js
import { generateText } from './openrouter.js';
import { publishToThreads } from './threads-api.js';
import { addToHistory, getPostHistory, incrementPostCount, setLastPostTimestamp, isRateLimited, getLastPostTimestamp } from './storage.js';
import { logger } from './logger.js';
import { withRetry } from './retry.js';

export async function runPipeline(config, options = {}) {
  const { dryRun = false } = options;
  const dbDir = config.dbDir || '/tmp';

  // Rate limit
  const now = Date.now();
  const lastPost = await getLastPostTimestamp(dbDir);
  const minSince = (now - lastPost) / 60000;
  if (minSince < 90 && lastPost > 0) {
    return { status: 'no_action', message: 'Wait ' + Math.ceil(90 - minSince) + ' min' };
  }
  if (await isRateLimited(dbDir)) {
    return { status: 'no_action', message: 'Daily rate limit' };
  }

  // History
  const history = await getPostHistory(dbDir, 5);
  const historyTexts = history.map(h => h.text);

  // Generate
  const keywords = config.searchQueries || ['trending'];
  let text;
  try {
    text = await withRetry(() => generateText(config, keywords, historyTexts));
  } catch (err) {
    return { status: 'error', error: 'AI failed: ' + err.message };
  }

  if (dryRun) {
    return { status: 'success', generatedText: text, dryRun: true };
  }

  // Post — skip if no threads token
  if (!config.threadsAccessToken || config.threadsAppId === 'dashboard') {
    return { status: 'success', generatedText: text, postId: null, dryRun: false, note: 'No Threads token (env var THREADS_ACCESS_TOKEN not set)' };
  }

  try {
    const postId = await withRetry(() => publishToThreads(config, text));
    await setLastPostTimestamp(dbDir, now);
    await incrementPostCount(dbDir);
    await addToHistory(dbDir, { text, postId, timestamp: now });
    return { status: 'success', generatedText: text, postId };
  } catch (err) {
    return { status: 'error', error: 'Post failed: ' + err.message };
  }
}
