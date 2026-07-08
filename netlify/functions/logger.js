// netlify/functions/logger.js
const levels = { debug: 0, info: 1, warn: 2, error: 3 };

function getLevel() {
  const lvl = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return levels[lvl] ?? levels.info;
}

export const logger = {
  debug(...args) { if (getLevel() <= levels.debug) console.log('[DEBUG]', ...args); },
  info(...args) { if (getLevel() <= levels.info) console.log('[INFO]', ...args); },
  warn(...args) { if (getLevel() <= levels.warn) console.warn('[WARN]', ...args); },
  error(...args) { console.error('[ERROR]', ...args); },
};
