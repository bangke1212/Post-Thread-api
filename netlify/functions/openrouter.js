// netlify/functions/openrouter.js — Agnes AI (free, OpenAI-compatible)
import { logger } from './logger.js';

const BASE_URL = 'https://apihub.agnes-ai.com/v1';

function buildPrompt(topic, history) {
  const historyBlock = history.length > 0 
    ? '\nJANGAN ulangi postingan sebelumnya:\n' + history.map((t,i) => (i+1) + '. ' + t.slice(0,80)).join('\n')
    : '';
  
  if (topic.includes('simpati') || topic.includes('menyentuh') || topic.includes('kebaikan')) {
    return 'Buat satu postingan menyentuh hati tentang ' + topic + '. Cerita relatable yang bikin orang terharu, percaya kebaikan, dan ingin berbagi. Bahasa Indonesia natural. Maks 280 karakter. 1 emoji maksimal. Akhiri dengan ajakan berbuat baik. NO hashtag. Output HANYA teks.' + historyBlock;
  }
  if (topic.includes('debat') || topic.includes('solusi') || topic.includes('diperdebatkan')) {
    return 'Buat satu postingan yang mengangkat isu ' + topic + '. Fair dan balanced, tunjukkan dua sisi. Ajak diskusi sehat, kasih sudut pandang solusi. Bahasa Indonesia dewasa dan respectful. Maks 280 karakter. NO hashtag. Output HANYA teks.' + historyBlock;
  }
  if (topic.includes('mengejek') || topic.includes('sindiran') || topic.includes('oknum') || topic.includes('koruptor')) {
    return 'Buat satu postingan satire/sindiran cerdas tentang ' + topic + '. Lucu, ngena, tapi tetap elegan — bukan ujaran kebencian. Gaya komedi sosial ala stand-up. Bahasa Indonesia. Maks 280 karakter. 1 emoji. NO hashtag. Output HANYA teks.' + historyBlock;
  }
  return 'Buat satu postingan pendek (maks 280 karakter) tentang "' + topic + '". Bahasa Indonesia natural dan engaging. Hook menarik di awal. 1 emoji maksimal. Akhiri dengan pertanyaan atau call-to-action. NO hashtag. Output HANYA teks postingan jadi.' + historyBlock;
}

export async function generateText(config, keywords, history = [], retries = 3) {
  const topic = keywords[0] || 'trending topic';
  const prompt = buildPrompt(topic, history);

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
