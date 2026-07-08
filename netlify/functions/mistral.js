// netlify/functions/mistral.js — Mistral AI — quality prompt + contextual emoji
// All 10 languages: id, en, zh, ko, ja, ru, nl, ms, su, jv
import { logger } from './logger.js';

const BASE_URL = 'https://api.mistral.ai/v1';

const TONE_EMOJI_MAP = {
  roasting:       { emoji: ['🔥','😏','💀','🗣️','😮‍💨'], desc: 'SATIRE PEDAS — tajam, lucu, ngena.' },
  lucu:           { emoji: ['😂','😭','🤣','💀','😆'], desc: 'HUMOR SEGAR.' },
  informatif:     { emoji: ['📌','🧠','💡','🔍','📊'], desc: 'INSIGHT BERHARGA.' },
  kaget:          { emoji: ['😱','🤯','💀','👀','😳'], desc: 'SHOCK / WTF.' },
  dukung:         { emoji: ['💪','✨','🥰','🤝','🌟'], desc: 'SUPPORTIF.' },
  skeptis:        { emoji: ['🤔','🧐','🗿','🙃','😐'], desc: 'SKEPTIS CERDAS.' },
  sedih:          { emoji: ['😢','💔','🥀','😔','🫂'], desc: 'MELANKOLIS.' },
  marah:          { emoji: ['😤','🤬','💢','😡','🔥'], desc: 'MARAH BERALASAN.' },
};

const LANG_CONFIG = {
  id: { system: 'Penulis konten viral Indonesia.', formatRule: 'Bahasa Indonesia natural. "gue/aku".', historyHeader: '\n⚠️ JANGAN ULANGI:\n', linkHeader: '\n📎 KONTEKS:\n', outputRule: 'HANYA TEKS POSTINGAN.', promptLang: 'Indonesia', tLabel: 'TOPIK:', nLabel: 'NADA:', eLabel: 'EMOJI:', rLabel: 'ATURAN:', wLabel: 'TULIS:' },
  en: { system: 'Viral internet content writer.', formatRule: 'Natural internet English. "I" not "we".', historyHeader: '\n⚠️ DO NOT REPEAT:\n', linkHeader: '\n📎 CONTEXT:\n', outputRule: 'ONLY POST TEXT.', promptLang: 'English', tLabel: 'TOPIC:', nLabel: 'TONE:', eLabel: 'EMOJIS:', rLabel: 'RULES:', wLabel: 'WRITE:' },
  zh: { system: '病毒式内容创作者。', formatRule: '自然的中文。', historyHeader: '\n⚠️ 不要重复：\n', linkHeader: '\n📎 参考：\n', outputRule: '只输出帖子文本。', promptLang: '中文', tLabel: '主题：', nLabel: '语气：', eLabel: '表情：', rLabel: '规则：', wLabel: '写：' },
  ko: { system: '바이럴 콘텐츠 크리에이터.', formatRule: '자연스러운 한국어.', historyHeader: '\n⚠️ 반복 금지:\n', linkHeader: '\n📎 컨텍스트:\n', outputRule: '게시물만.', promptLang: '한국어', tLabel: '주제:', nLabel: '톤:', eLabel: '이모지:', rLabel: '규칙:', wLabel: '작성:' },
  ja: { system: '日本語バイラルクリエイター。', formatRule: '自然な日本語。', historyHeader: '\n⚠️ 繰り返し禁止:\n', linkHeader: '\n📎 コンテキスト:\n', outputRule: '投稿のみ。', promptLang: '日本語', tLabel: 'トピック：', nLabel: 'トーン：', eLabel: '絵文字：', rLabel: 'ルール：', wLabel: '作成：' },
  ru: { system: 'Создатель вирусного контента.', formatRule: 'Естественный русский.', historyHeader: '\n⚠️ НЕ повторять:\n', linkHeader: '\n📎 КОНТЕКСТ:\n', outputRule: 'Только пост.', promptLang: 'Русский', tLabel: 'ТЕМА:', nLabel: 'ТОН:', eLabel: 'ЭМОДЗИ:', rLabel: 'ПРАВИЛА:', wLabel: 'НАПИШИ:' },
  nl: { system: 'Virale content creator.', formatRule: 'Natuurlijk Nederlands.', historyHeader: '\n⚠️ NIET HERHALEN:\n', linkHeader: '\n📎 CONTEXT:\n', outputRule: 'ALLEEN post-tekst.', promptLang: 'Nederlands', tLabel: 'ONDERWERP:', nLabel: 'TOON:', eLabel: 'EMOJI:', rLabel: 'REGELS:', wLabel: 'SCHRIJF:' },
  ms: { system: 'Pencipta kandungan viral.', formatRule: 'Bahasa Melayu natural.', historyHeader: '\n⚠️ JANGAN ULANG:\n', linkHeader: '\n📎 KONTEKS:\n', outputRule: 'HANYA teks postingan.', promptLang: 'Melayu', tLabel: 'TOPIK:', nLabel: 'NADA:', eLabel: 'EMOJI:', rLabel: 'PERATURAN:', wLabel: 'TULIS:' },
  su: { system: 'Nyieun kontén viral Sunda.', formatRule: 'Basa Sunda loma.', historyHeader: '\n⚠️ ULAH DIULANG:\n', linkHeader: '\n📎 KONTEKS:\n', outputRule: 'WAUNG téks postingan.', promptLang: 'Sunda', tLabel: 'JEJER:', nLabel: 'NADA:', eLabel: 'EMOJI:', rLabel: 'ATURAN:', wLabel: 'JIEUN:' },
  jv: { system: 'Nggawé kontén viral Jawa.', formatRule: 'Basa Jawa ngoko.', historyHeader: '\n⚠️ OJO MBALÈNI:\n', linkHeader: '\n📎 KONTEKS:\n', outputRule: 'MUNG téks postingan.', promptLang: 'Jawa', tLabel: 'BAB:', nLabel: 'NADA:', eLabel: 'EMOJI:', rLabel: 'ATURAN:', wLabel: 'GAWÉ:' },
};

function getLC(lang) { return LANG_CONFIG[lang] || LANG_CONFIG.id; }

function buildPrompt(topic, tone, history, linkContent, lang) {
  const lc = getLC(lang);
  const t = TONE_EMOJI_MAP[tone] || TONE_EMOJI_MAP.informatif;
  const hb = history.length ? lc.historyHeader + history.map((h, i) => `${i + 1}. ${h.slice(0, 80)}`).join('\n') : '';
  const lb = (linkContent && linkContent.length > 10) ? lc.linkHeader + linkContent.slice(0, 1000) : '';

  return `BUAT 1 POSTINGAN THREADS VIRAL — ${lc.promptLang}.

${lc.tLabel} ${topic}
${lc.nLabel} ${t.desc}
${lc.eLabel} ${t.emoji.join(' ')}

${lc.rLabel}
- ${lc.formatRule}
- Maks 280 karakter
- WAJIB: 2-3 emoji dari atas, natural di tengah
- Emoji pertama = pembuka
- NO hashtag/link/mention
- Akhiri open loop
${lb}
${hb}

${lc.outputRule}

${lc.wLabel}`; 
}

export async function generateTextMistral(config, keywords, history = [], tone = '', linkContent = '', retries = 3) {
  const lang = config.lang || 'id';
  const topic = keywords[0] || 'trending';
  const toneInput = tone || config.tone || 'informatif';
  const model = config.mistralModel || 'mistral-small-latest';
  const lc = getLC(lang);

  const body = {
    model,
    messages: [
      { role: 'system', content: lc.system },
      { role: 'user', content: buildPrompt(topic, toneInput, history, linkContent, lang) },
    ],
    max_tokens: 250,
    temperature: 0.88,
  };

  logger.info('[Mistral]', { model, topic, tone: toneInput, lang });

  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.mistralApiKey}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.text();
        if (res.status === 429 && attempt < retries - 1) { await new Promise(r => setTimeout(r, (attempt + 1) * 5000)); continue; }
        throw new Error(`Mistral ${res.status}: ${e.slice(0, 200)}`);
      }
      const data = await res.json();
      let text = data.choices[0].message.content.trim();
      text = text.replace(/^["'""'']|["'""'']$/g, '').trim();
      text = text.replace(/^(Postingan:|Post:|Berikut|Ini dia)/i, '').trim();
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
    }
  }
  throw lastError || new Error('Mistral: exhausted');
}
