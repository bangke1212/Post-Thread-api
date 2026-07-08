// netlify/functions/storage.js
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { logger } from './logger.js';

export function getStoragePath(dir) {
  return dir || '/tmp';
}

export async function readJSON(filePath) {
  try {
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeJSON(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getLastPostTimestamp(dbDir) {
  const path = join(dbDir, 'last_post.json');
  const data = await readJSON(path);
  return data?.timestamp || 0;
}

export async function setLastPostTimestamp(dbDir, timestamp) {
  const path = join(dbDir, 'last_post.json');
  await writeJSON(path, { timestamp });
  logger.info('Updated last post timestamp', { timestamp });
}

export async function isRateLimited(dbDir) {
  const path = join(dbDir, 'rate_limit.json');
  const data = await readJSON(path);
  if (!data) return false;
  // Reset after 3 hours
  if (Date.now() - data.timestamp > 3 * 60 * 60 * 1000) return false;
  return data.count >= 20;
}

export async function incrementPostCount(dbDir) {
  const path = join(dbDir, 'rate_limit.json');
  let data = await readJSON(path);
  if (!data || Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
    data = { count: 0, timestamp: Date.now() };
  }
  data.count++;
  data.timestamp = Date.now();
  await writeJSON(path, data);
  return data.count;
}

export async function getPostHistory(dbDir, limit = 5) {
  const path = join(dbDir, 'history.json');
  const data = await readJSON(path);
  return data?.posts?.slice(-limit) || [];
}

export async function addToHistory(dbDir, post) {
  const path = join(dbDir, 'history.json');
  let data = await readJSON(path);
  if (!data) data = { posts: [] };
  data.posts.push(post);
  if (data.posts.length > 100) data.posts = data.posts.slice(-100);
  await writeJSON(path, data);
}
