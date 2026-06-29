import { getConfig } from './config.js';
import { generateText } from './openrouter.js';
import { publishToThreads } from './threads-api.js';
import { addToHistory, getPostHistory, incrementPostCount, setLastPostTimestamp, isRateLimited, getLastPostTimestamp } from './storage.js';
import { logger } from './logger.js';
import { withRetry } from './retry.js';

export async function runPipeline(config, options = {}) {
  const { dryRun = false } = options;
  const dbDir = config.dbDir || '/tmp';

  // Rate limit check
  const now = Date.now();
  const lastPost = await getLastPostTimestamp(dbDir);
  const minutesSinceLastPost = (now - lastPost) / 60000;
  
  if (minutesSinceLastPost < 90 && lastPost > 0) {
    return { status: 'no_action', message: 'Wait ' + Math.ceil(90 - minutesSinceLastPost) + ' min' };
  }

  if (await isRateLimited(dbDir)) {
    return { status: 'no_action', message: 'Daily rate limit' };
  }

  // Get history
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

  // Post
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
