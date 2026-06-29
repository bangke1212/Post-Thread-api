// netlify/functions/openrouter.js — Agnes AI (free, OpenAI-compatible)
import { logger } from './logger.js';

const API_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';

export async function generateText(config, keywords, history = [], retries = 3) {
  const topic = keywords[0] || 'trending topic';
  const prompt = 'Buat satu postingan Threads viral tentang "' + topic + '". Maks 500 karakter, Bahasa Indonesia natural, hook kuat, 1-2 emoji, akhiri dengan CTA atau diskusi. NO hashtag. Output HANYA teks.';

  const body = {
    model: config.openrouterModel || 'Agnes-2.0-Flash',
    messages: [
      { role: 'system', content: 'Kamu content creator Indonesia jago bikin postingan viral di Threads.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 300,
    temperature: 0.9,
  };

  logger.info('Agnes AI call', { model: body.model, topic });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.openrouterApiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const e = await res.text();
    throw new Error('Agnes AI ' + res.status + ': ' + e.slice(0, 200));
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}
