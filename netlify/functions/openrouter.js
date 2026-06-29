// netlify/functions/openrouter.js — Agnes AI (free, OpenAI-compatible)
import { logger } from './logger.js';

const BASE_URL = 'https://apihub.agnes-ai.com/v1';

export async function generateText(config, keywords, history = [], retries = 3) {
  const topic = keywords[0] || 'trending topic';
  const prompt = 'Buat satu postingan pendek (maks 280 karakter, cocok buat X/Twitter) tentang "' + topic + '". Bahasa Indonesia natural dan engaging. Gaya santai tapi insightful. Hook menarik di awal. 1 emoji maksimal. Akhiri dengan pertanyaan atau call-to-action ringan. NO hashtag, NO quote mark di awal/akhir. Output HANYA teks postingan jadi, jangan ada intro atau outro lain.';

  const body = {
    model: 'agnes-2.0-flash',
    messages: [
      { role: 'system', content: 'Kamu content creator Indonesia jago bikin postingan viral di Threads.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 300,
    temperature: 0.9,
  };

  logger.info('Agnes AI', { model: body.model, topic });

  const res = await fetch(BASE_URL + '/chat/completions', {
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
