// netlify/functions/prompt.js
import { logger } from './logger.js';

export function pickKeywords(config) {
  const queries = config.searchQueries || ['trending', 'viral', 'tech'];
  // Pick 3-5 random keywords
  const shuffled = [...queries].sort(() => Math.random() - 0.5);
  const count = Math.min(5, Math.max(3, shuffled.length));
  const picked = shuffled.slice(0, count);
  logger.info('Keywords picked', { picked });
  return picked;
}

export function formatPost(text) {
  // Clean up
  let cleaned = text
    .replace(/^["']|["']$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Ensure max 500 chars
  if (cleaned.length > 500) {
    cleaned = cleaned.slice(0, 497) + '...';
  }
  
  return cleaned;
}
