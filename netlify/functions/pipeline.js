// netlify/functions/pipeline.js
// Three providers: Agnes, Mistral, IAMHC (幻城网安)
import { generateText } from './openrouter.js';
import { generateTextMistral } from './mistral.js';
import { generateTextIAMHC } from './iamhc.js';
import { publishToThreads } from './threads-api.js';
import { addToHistory, getPostHistory, incrementPostCount, setLastPostTimestamp, isRateLimited, getLastPostTimestamp } from './storage.js';
import { logger } from './logger.js';
import { withRetry } from './retry.js';

// ── Shared helpers ───────────────────────────────────────────────
async function checkRateLimit(dbDir) {
  const now = Date.now();
  const lastPost = await getLastPostTimestamp(dbDir);
  const minSince = (now - lastPost) / 60000;
  if (minSince < 90 && lastPost > 0) {
    return { blocked: true, message: 'Wait ' + Math.ceil(90 - minSince) + ' min' };
  }
  if (await isRateLimited(dbDir)) {
    return { blocked: true, message: 'Daily rate limit' };
  }
  return { blocked: false };
}

async function postAndLog(config, text, dbDir) {
  if (!config.threadsAccessToken || config.threadsAppId === 'dashboard') {
    return { status: 'success', generatedText: text, postId: null, dryRun: false, note: 'No posting token configured — text ready' };
  }
  const now = Date.now();
  const postId = await withRetry(() => publishToThreads(config, text));
  await setLastPostTimestamp(dbDir, now);
  await incrementPostCount(dbDir);
  await addToHistory(dbDir, { text, postId, timestamp: now });
  return { status: 'success', generatedText: text, postId };
}

// ── Agnes Pipeline ───────────────────────────────────────────────
export async function runPipelineAgnes(config, options = {}) {
  const { dryRun = false } = options;
  const dbDir = config.dbDir || '/tmp';
  const rate = await checkRateLimit(dbDir);
  if (rate.blocked) return { status: 'no_action', message: rate.message };
  const history = await getPostHistory(dbDir, 5);
  const historyTexts = history.map(h => h.text);
  const linkContent = (config.linkContent || '').slice(0, 3000);
  const keywords = config.searchQueries || ['trending'];
  let text;
  try {
    text = await withRetry(() => generateText(config, keywords, historyTexts, config.tone || '', linkContent));
  } catch (err) {
    return { status: 'error', error: 'Agnes AI failed: ' + err.message, provider: 'agnes' };
  }
  if (dryRun) return { status: 'success', generatedText: text, dryRun: true, provider: 'agnes' };
  try {
    const result = await postAndLog(config, text, dbDir);
    return { ...result, provider: 'agnes' };
  } catch (err) {
    return { status: 'error', error: 'Post failed: ' + err.message, provider: 'agnes' };
  }
}

// ── Mistral Pipeline ──────────────────────────────────────────────
export async function runPipelineMistral(config, options = {}) {
  const { dryRun = false } = options;
  const dbDir = config.dbDir || '/tmp';
  const rate = await checkRateLimit(dbDir);
  if (rate.blocked) return { status: 'no_action', message: rate.message };
  const history = await getPostHistory(dbDir, 5);
  const historyTexts = history.map(h => h.text);
  const linkContent = (config.linkContent || '').slice(0, 3000);
  const keywords = config.searchQueries || ['trending'];
  let text;
  try {
    text = await withRetry(() => generateTextMistral(config, keywords, historyTexts, config.tone || '', linkContent));
  } catch (err) {
    return { status: 'error', error: 'Mistral AI failed: ' + err.message, provider: 'mistral' };
  }
  if (dryRun) return { status: 'success', generatedText: text, dryRun: true, provider: 'mistral' };
  try {
    const result = await postAndLog(config, text, dbDir);
    return { ...result, provider: 'mistral' };
  } catch (err) {
    return { status: 'error', error: 'Post failed: ' + err.message, provider: 'mistral' };
  }
}

// ── IAMHC (幻城网安) Pipeline ──────────────────────────────────────
export async function runPipelineIAMHC(config, options = {}) {
  const { dryRun = false } = options;
  const dbDir = config.dbDir || '/tmp';
  const rate = await checkRateLimit(dbDir);
  if (rate.blocked) return { status: 'no_action', message: rate.message };
  const history = await getPostHistory(dbDir, 5);
  const historyTexts = history.map(h => h.text);
  const linkContent = (config.linkContent || '').slice(0, 3000);
  const keywords = config.searchQueries || ['trending'];
  let text;
  try {
    text = await withRetry(() => generateTextIAMHC(config, keywords, historyTexts, config.tone || '', linkContent));
  } catch (err) {
    return { status: 'error', error: 'IAMHC (幻城网安) failed: ' + err.message, provider: 'iamhc' };
  }
  if (dryRun) return { status: 'success', generatedText: text, dryRun: true, provider: 'iamhc' };
  try {
    const result = await postAndLog(config, text, dbDir);
    return { ...result, provider: 'iamhc' };
  } catch (err) {
    return { status: 'error', error: 'Post failed: ' + err.message, provider: 'iamhc' };
  }
}

// ── Legacy wrapper (backward compat) ──────────────────────────────
export async function runPipeline(config, options = {}) {
  if (config.aiProvider === 'iamhc') return runPipelineIAMHC(config, options);
  if (config.aiProvider === 'mistral') return runPipelineMistral(config, options);
  return runPipelineAgnes(config, options);
}
