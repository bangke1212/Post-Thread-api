// netlify/functions/pipeline.js
import { getConfig } from './config.js';
import { pickKeywords, formatPost } from './prompt.js';
import { generateText } from './openrouter.js';
import { publishToThreads } from './threads-api.js';
import { 
  isRateLimited, incrementPostCount, getPostHistory, addToHistory,
  getLastPostTimestamp, setLastPostTimestamp 
} from './storage.js';
import { logger } from './logger.js';
import { withRetry } from './retry.js';

const MIN_INTERVAL_MINUTES = 90; // Minimum 90 min between posts

export async function runPipeline(config, options = {}) {
  const { dryRun = false } = options;
  const dbDir = config.dbDir || '/tmp';

  // Rate limit check
  const now = Date.now();
  const lastPost = await getLastPostTimestamp(dbDir);
  const minutesSinceLastPost = (now - lastPost) / 60000;
  
  if (minutesSinceLastPost < MIN_INTERVAL_MINUTES && lastPost > 0) {
    const waitMinutes = Math.ceil(MIN_INTERVAL_MINUTES - minutesSinceLastPost);
    return { status: 'no_action', message: `Wait ${waitMinutes} more minutes before next post` };
  }

  if (await isRateLimited(dbDir)) {
    return { status: 'no_action', message: 'Daily rate limit reached' };
  }

  // Pick keywords
  const keywords = pickKeywords(config);
  
  // Get history to avoid repetition
  const history = await getPostHistory(dbDir, 10);
  const historyTexts = history.map(h => h.text);

  // Generate with AI
  let generatedText;
  try {
    generatedText = await withRetry(() => generateText(config, keywords, historyTexts));
  } catch (err) {
    return { status: 'error', error: `AI generation failed: ${err.message}` };
  }

  // Format
  const postText = formatPost(generatedText);
  logger.info('Post ready', { text: postText.slice(0, 50) + '...' });

  if (dryRun) {
    return { status: 'success', generatedText: postText, dryRun: true };
  }

  // Post to Threads
  try {
    const postId = await withRetry(() => publishToThreads(config, postText));
    
    // Update storage
    await setLastPostTimestamp(dbDir, now);
    await incrementPostCount(dbDir);
    await addToHistory(dbDir, { text: postText, postId, timestamp: now });
    
    logger.info('Pipeline complete', { postId });
    return { status: 'success', postId, generatedText: postText };
  } catch (err) {
    return { status: 'error', error: `Post failed: ${err.message}` };
  }
}
