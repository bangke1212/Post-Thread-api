// netlify/functions/openrouter.js — Agnes AI (free, OpenAI-compatible)
import { logger } from './logger.js';

const BASE_URL = 'https://apihub.agnes-ai.com/v1';

function buildPrompt(topic, tone, history) {
  const historyBlock = history.length > 0 
    ? '\nJANGAN ulangi postingan sebelumnya:\n' + history.map((t,i) => (i+1) + '. ' + t.slice(0,80)).join('\n')
    : '';
  
  const toneMap = {
    'simpati':        'NADA SIMPATI / MENYENTUH HATI. Cerita relatable yang bikin pembaca terharu, ingin berbuat baik, percaya kebaikan. Hangat, manusiawi. 1 emoji 🥹💚🤝.',
    'debat+solusi':   'NADA DEBAT SEHAT + SOLUSI. Fair & balanced, tunjukkan dua sisi. Ajak diskusi dewasa, kasih sudut pandang membangun. Respectful. No emoji atau 1 maks.',
    'mengejek oknum': 'NADA SATIRE / SINDIRAN CERDAS. Lucu, ngena, elegan — bukan ujaran kebencian. Gaya komedi sosial, ketawa getir. 1 emoji 😏🎭.',
    'marah':          'NADA MARAH / GERAM. Emosi meledak tapi tetap elegan, bukan cacian. Ungkapin kekecewaan atau kemarahan yang justified. 1-2 emoji 😤🤬🔥.',
    'kaget':          'NADA KAGET / SHOCK. Terkejut, tidak percaya, wtf moment. Dramatis tapi tetap engaging. 1-2 emoji 😱🤯💀.',
    'sedih':          'NADA SEDIH / MELANKOLIS. Menyentuh, sendu, bikin pembaca ikut merasakan. Puitis tapi nggak lebay. 1 emoji 😢💔🥀.',
    'bangga':         'NADA BANGGA / CELEBRATORY. Energi positif, uplifting, membanggakan. Rayakan pencapaian atau hal baik. 1-2 emoji 🥳🎉🔥.',
    'takut':          'NADA TAKUT / CEMAS. Bikin merinding, warning, concern yang genuine. Bukan fearmongering. 1 emoji 😨😰⚠️.'
  };
  
  const toneInstruction = toneMap[tone] || '';
  const toneBlock = toneInstruction 
    ? 'Gunakan ' + toneInstruction + '\n'
    : '';

  return 'Buat satu postingan pendek (maks 280 karakter) tentang "' + topic + '".\n' +
    toneBlock +
    'Bahasa Indonesia natural dan engaging. Maks 280 karakter. NO hashtag, NO kutipan di awal/akhir. Output HANYA teks postingan jadi, jangan ada intro/outro lain.' + 
    historyBlock;
}export async function generateText(config, keywords, history = [], tone = '', retries = 3) {
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
