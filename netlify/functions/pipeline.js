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

  // If link provided, fetch content first (X/Twitter → fxtwitter)
  let linkContent = '';
  if (config.link) {
    const url = config.link;
    let fetchUrl = url;
    
    // Auto-convert Twitter/X links to fxtwitter (works without login)
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'x.com' || urlObj.hostname === 'twitter.com') {
        fetchUrl = url.replace(/\/(twitter|x)\.com\//, '/fxtwitter.com/');
      }
    } catch {}
    
    try {
      logger.info('Fetching link', { url: fetchUrl });
      const linkRes = await fetch(fetchUrl, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PostBot/1.0)' },
        signal: AbortSignal.timeout(12000),
        redirect: 'follow'
      });
      if (linkRes.ok) {
        const raw = await linkRes.text();
        
        // Try og:description first (works for fxtwitter + most sites)
        const ogDesc = raw.match(/<meta[^>]*og:description[^>]*content="([^"]*)"/);
        const ogTitle = raw.match(/<meta[^>]*og:title[^>]*content="([^"]*)"/);
        if (ogDesc) {
          linkContent = (ogTitle ? ogTitle[1].replace(/ on X$/, '') + ': ' : '') + ogDesc[1];
          linkContent = linkContent.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
        } else {
          linkContent = raw
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000);
        }
        logger.info('Link fetched', { length: linkContent.length });
      } else {
        logger.warn('Link fetch failed, status', { status: linkRes.status });
      }
    } catch (e) {
      logger.warn('Link fetch error', { error: e.message });
    }
  }

  // Generate
  const keywords = config.searchQueries || ['trending'];
  let text;
  try {
    text = await withRetry(() => generateText(config, keywords, historyTexts, config.tone || '', linkContent));
  } catch (err) {
    return { status: 'error', error: 'AI failed: ' + err.message };
  }

  if (dryRun) {
    return { status: 'success', generatedText: text, dryRun: true };
  }

  // Post — skip if no threads token
  if (!config.threadsAccessToken || config.threadsAppId === 'dashboard') {
    return { status: 'success', generatedText: text, postId: null, dryRun: false, note: 'No posting token configured — text ready' };
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
