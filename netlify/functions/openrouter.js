// netlify/functions/openrouter.js — Agnes AI (free, OpenAI-compatible)
import { logger } from './logger.js';

const BASE_URL = 'https://apihub.agnes-ai.com/v1';

function buildPrompt(topic, tone, history) {
  const historyBlock = history.length > 0 
    ? '\nJANGAN ulangi postingan sebelumnya:\n' + history.map((t,i) => (i+1) + '. ' + t.slice(0,80)).join('\n')
    : '';
  
  if (tone === 'simpati') {
    return 'Buat satu postingan dengan NADA SIMPATI / menyentuh hati tentang "' + topic + '". Cerita relatable yang bikin orang terharu dan ingin berbuat baik. Bahasa Indonesia natural. Maks 280 karakter. 1 emoji maksimal. NO hashtag. Output HANYA teks.' + historyBlock;
  }
  if (tone === 'debat+solusi') {
    return 'Buat satu postingan dengan NADA DEBAT SEHAT + SOLUSI tentang "' + topic + '". Fair dan balanced, tunjukkan dua sisi. Ajak diskusi dewasa. Bahasa Indonesia respectful. Maks 280 karakter. NO hashtag. Output HANYA teks.' + historyBlock;
  }
  if (tone === 'mengejek oknum') {
    return 'Buat satu postingan dengan NADA SATIRE / SINDIRAN CERDAS tentang "' + topic + '". Lucu, ngena, elegan — bukan ujaran kebencian. Gaya komedi sosial. Bahasa Indonesia. Maks 280 karakter. 1 emoji. NO hashtag. Output HANYA teks.' + historyBlock;
  }
  return 'Buat satu postingan pendek (maks 280 karakter) tentang "' + topic + '". Bahasa Indonesia natural dan engaging. Hook menarik di awal. 1 emoji maksimal. Akhiri dengan pertanyaan atau call-to-action. NO hashtag. Output HANYA teks postingan jadi.' + historyBlock;
}

export async function generateText(config, keywords, history = [], tone = '', retries = 3) {
  const topic = keywords[0] || 'trending topic';
  const toneInput = tone || config.tone || '';
  const prompt = buildPrompt(topic, toneInput, history);

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
