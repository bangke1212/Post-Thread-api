// netlify/functions/iamhc.js — IAMHC (幻城网安) — quality prompt + contextual emoji
// All 10 languages: id, en, zh, ko, ja, ru, nl, ms, su, jv
import { logger } from './logger.js';

const BASE_URL = 'https://api.iamhc.cn/v1';

const TONE_EMOJI_MAP = {
  roasting:       { emoji: ['🔥','😏','💀','🗣️','😮‍💨'], desc: 'SATIRE PEDAS — tajam, lucu, ngena.' },
  lucu:           { emoji: ['😂','😭','🤣','💀','😆'], desc: 'HUMOR SEGAR — lucu natural, relatable.' },
  informatif:     { emoji: ['📌','🧠','💡','🔍','📊'], desc: 'INSIGHT BERHARGA — fakta menarik.' },
  kaget:          { emoji: ['😱','🤯','💀','👀','😳'], desc: 'SHOCK / WTF — mindblown, dramatis.' },
  dukung:         { emoji: ['💪','✨','🥰','🤝','🌟'], desc: 'SUPPORTIF — uplifting, wholesome.' },
  skeptis:        { emoji: ['🤔','🧐','🗿','🙃','😐'], desc: 'SKEPTIS CERDAS — questioning.' },
  sedih:          { emoji: ['😢','💔','🥀','😔','🫂'], desc: 'MELANKOLIS — sendu, vulnerable.' },
  marah:          { emoji: ['😤','🤬','💢','😡','🔥'], desc: 'MARAH BERALASAN — impactful.' },
};

const LANG_CONFIG = {
  id: { system: 'Kamu penulis konten viral Indonesia.', formatRule: 'Bahasa Indonesia natural. "gue/aku".', historyHeader: '\n⚠️ JANGAN ULANGI:\n', linkHeader: '\n📎 KONTEKS:\n', outputRule: 'HANYA TEKS POSTINGAN.', promptLang: 'Indonesia', topicLabel: 'TOPIK:', toneLabel: 'NADA:', emojiLabel: 'EMOJI:', rulesLabel: 'ATURAN:', writeLabel: 'TULIS:' },
  en: { system: 'You write viral internet content.', formatRule: 'Natural internet English. "I" not "we".', historyHeader: '\n⚠️ DO NOT REPEAT:\n', linkHeader: '\n📎 CONTEXT:\n', outputRule: 'ONLY POST TEXT.', promptLang: 'English', topicLabel: 'TOPIC:', toneLabel: 'TONE:', emojiLabel: 'EMOJIS:', rulesLabel: 'RULES:', writeLabel: 'WRITE:' },
  zh: { system: '你是写病毒式内容的创作者。', formatRule: '自然地道的中文。', historyHeader: '\n⚠️ 不要重复：\n', linkHeader: '\n📎 参考：\n', outputRule: '只输出帖子文本。', promptLang: '中文', topicLabel: '主题：', toneLabel: '语气：', emojiLabel: '表情：', rulesLabel: '规则：', writeLabel: '写：' },
  ko: { system: '바이럴 콘텐츠 크리에이터.', formatRule: '자연스러운 한국어.', historyHeader: '\n⚠️ 반복 금지:\n', linkHeader: '\n📎 컨텍스트:\n', outputRule: '게시물 텍스트만.', promptLang: '한국어', topicLabel: '주제:', toneLabel: '톤:', emojiLabel: '이모지:', rulesLabel: '규칙:', writeLabel: '작성:' },
  ja: { system: '日本語バイラルコンテンツクリエイター。', formatRule: '自然な日本語。', historyHeader: '\n⚠️ 繰り返し禁止:\n', linkHeader: '\n📎 コンテキスト:\n', outputRule: '投稿テキストのみ。', promptLang: '日本語', topicLabel: 'トピック：', toneLabel: 'トーン：', emojiLabel: '絵文字：', rulesLabel: 'ルール：', writeLabel: '作成：' },
  ru: { system: 'Создатель вирусного контента.', formatRule: 'Естественный русский.', historyHeader: '\n⚠️ НЕ повторять:\n', linkHeader: '\n📎 КОНТЕКСТ:\n', outputRule: 'Только текст поста.', promptLang: 'Русский', topicLabel: 'ТЕМА:', toneLabel: 'ТОН:', emojiLabel: 'ЭМОДЗИ:', rulesLabel: 'ПРАВИЛА:', writeLabel: 'НАПИШИ:' },
  nl: { system: 'Virale content creator.', formatRule: 'Natuurlijk Nederlands.', historyHeader: '\n⚠️ NIET HERHALEN:\n', linkHeader: '\n📎 CONTEXT:\n', outputRule: 'ALLEEN post-tekst.', promptLang: 'Nederlands', topicLabel: 'ONDERWERP:', toneLabel: 'TOON:', emojiLabel: 'EMOJI:', rulesLabel: 'REGELS:', writeLabel: 'SCHRIJF:' },
  ms: { system: 'Pencipta kandungan viral.', formatRule: 'Bahasa Melayu natural.', historyHeader: '\n⚠️ JANGAN ULANG:\n', linkHeader: '\n📎 KONTEKS:\n', outputRule: 'HANYA teks postingan.', promptLang: 'Melayu', topicLabel: 'TOPIK:', toneLabel: 'NADA:', emojiLabel: 'EMOJI:', rulesLabel: 'PERATURAN:', writeLabel: 'TULIS:' },
  su: { system: 'Nyieun kontén viral Sunda.', formatRule: 'Basa Sunda loma natural.', historyHeader: '\n⚠️ ULAH DIULANG:\n', linkHeader: '\n📎 KONTEKS:\n', outputRule: 'WAUNG téks postingan.', promptLang: 'Sunda', topicLabel: 'JEJER:', toneLabel: 'NADA:', emojiLabel: 'EMOJI:', rulesLabel: 'ATURAN:', writeLabel: 'JIEUN:' },
  jv: { system: 'Nggawé kontén viral Jawa.', formatRule: 'Basa Jawa ngoko alami.', historyHeader: '\n⚠️ OJO MBALÈNI:\n', linkHeader: '\n📎 KONTEKS:\n', outputRule: 'MUNG téks postingan.', promptLang: 'Jawa', topicLabel: 'BAB:', toneLabel: 'NADA:', emojiLabel: 'EMOJI:', rulesLabel: 'ATURAN:', writeLabel: 'GAWÉ:' },
};

function getLC(lang) { return LANG_CONFIG[lang] || LANG_CONFIG.id; }

function buildPrompt(topic, tone, history, linkContent, lang) {
  const lc = getLC(lang);
  const t = TONE_EMOJI_MAP[tone] || TONE_EMOJI_MAP.informatif;
  const hb = history.length ? lc.historyHeader + history.map((h, i) => `${i + 1}. ${h.slice(0, 80)}`).join('\n') : '';
  const lb = (linkContent && linkContent.length > 10) ? lc.linkHeader + linkContent.slice(0, 1000) : '';

  return `BUAT 1 POSTINGAN THREADS VIRAL — ${lc.promptLang}.

${lc.topicLabel} ${topic}
${lc.toneLabel} ${t.desc}
${lc.emojiLabel} ${t.emoji.join(' ')}

${lc.rulesLabel}
- ${lc.formatRule}
- Maks 280 karakter
- WAJIB: 2-3 emoji dari atas, natural di tengah
- Emoji pertama = pembuka
- NO hashtag/link/mention
- Akhiri open loop
${lb}
${hb}

${lc.outputRule}

${lc.writeLabel}`; 
}

export const IAMHC_MODELS = {
  recommended: [
    { id: 'auto', name: '🆓 Auto Route ⭐', strengths: ['auto-best'], bestFor: 'Auto-pilih terbaik' },
    { id: 'Qwen3.5-397B-A17B', name: '🆓 Qwen 3.5 ⭐', strengths: ['natural_id','multilingual'], bestFor: 'Bahasa paling natural' },
    { id: 'glm-4.7', name: '🆓 GLM 4.7', strengths: ['conversational'], bestFor: 'Conversational' },
  ],
  all: ['auto','Qwen3.5-397B-A17B','glm-4.7'],
  rateLimit: '800/5jam free tier',
  docs: 'https://api.iamhc.cn',
};

export async function generateTextIAMHC(config, keywords, history = [], tone = '', linkContent = '', retries = 3) {
  const lang = config.lang || 'id';
  const topic = keywords[0] || 'trending';
  const toneInput = tone || config.tone || 'informatif';
  const model = config.iamhcModel || 'auto';
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

  logger.info('[IAMHC]', { model, topic, tone: toneInput, lang });

  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.iamhcApiKey}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.text();
        if (res.status === 429 && attempt < retries - 1) { await new Promise(r => setTimeout(r, (attempt + 1) * 10000)); continue; }
        throw new Error(`IAMHC ${res.status}: ${e.slice(0, 200)}`);
      }
      const data = await res.json();
      let text = data.choices[0].message.content.trim();
      text = text.replace(/^["'""'']|["'""'']$/g, '').trim();
      text = text.replace(/^(Postingan:|Post:|Berikut|Ini dia)/i, '').trim();
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
    }
  }
  throw lastError || new Error('IAMHC: exhausted');
}
