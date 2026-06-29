// netlify/functions/retry.js
export async function withRetry(fn, { maxRetries = 3, baseDelay = 2000 } = {}) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
