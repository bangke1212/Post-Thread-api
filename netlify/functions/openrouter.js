// netlify/functions/openrouter.js — Agnes AI (quality prompt + contextual emoji)
// All 10 languages: id, en, zh, ko, ja, ru, nl, ms, su, jv
import { logger } from './logger.js';

const BASE_URL = 'https://apihub.agnes-ai.com/v1';

const TONE_EMOJI_MAP = {
  roasting:       { emoji: ['🔥','😏','💀','🗣️','😮‍💨'], desc: 'SATIRE PEDAS — tajam, lucu, ngena. Gaya roaster cerdas.' },
  lucu:           { emoji: ['😂','😭','🤣','💀','😆'], desc: 'HUMOR SEGAR — lucu natural, relatable.' },
  informatif:     { emoji: ['📌','🧠','💡','🔍','📊'], desc: 'INSIGHT BERHARGA — fakta menarik, perspektif baru.' },
  kaget:          { emoji: ['😱','🤯','💀','👀','😳'], desc: 'SHOCK / WTF — mindblown, dramatis.' },
  dukung:         { emoji: ['💪','✨','🥰','🤝','🌟'], desc: 'SUPPORTIF — uplifting, wholesome vibes.' },
  skeptis:        { emoji: ['🤔','🧐','🗿','🙃','😐'], desc: 'SKEPTIS CERDAS — analitis, questioning.' },
  sedih:          { emoji: ['😢','💔','🥀','😔','🫂'], desc: 'MELANKOLIS — sendu, vulnerable, menyentuh.' },
  marah:          { emoji: ['😤','🤬','💢','😡','🔥'], desc: 'MARAH BERALASAN — justified anger, impactful.' },
};

const LANG_CONFIG = {
  id: { system: 'Kamu penulis konten viral Indonesia. Tulisanmu tajam, lucu, relatable — bukan generik AI.', formatRule: 'Bahasa Indonesia natural. "gue/aku". Slang 1-2x. EYD: titik + koma.', historyHeader: '\n⚠️ JANGAN ULANGI:\n', linkHeader: '\n📎 KONTEKS (inspirasi, JANGAN COPAS):\n', outputRule: 'OUTPUT HANYA TEKS POSTINGAN. JANGAN intro/label/kutipan.', promptLang: 'Indonesia', topicPrefix: 'TOPIK:', tonePrefix: 'NADA:', emojiLabel: 'EMOJI COCOK:', rulesLabel: 'ATURAN:', writeLabel: 'TULIS POSTINGAN:' },
  en: { system: 'You write viral internet content. Sharp, native, relatable.', formatRule: 'Natural internet English. "I" not "we". Slang OK: "fr", "ngl".', historyHeader: '\n⚠️ DO NOT REPEAT:\n', linkHeader: '\n📎 CONTEXT (inspiration only):\n', outputRule: 'OUTPUT ONLY THE POST TEXT. NO intros/labels.', promptLang: 'English', topicPrefix: 'TOPIC:', tonePrefix: 'TONE:', emojiLabel: 'MATCHING EMOJIS:', rulesLabel: 'RULES:', writeLabel: 'WRITE POST:' },
  zh: { system: '你是写病毒式内容的创作者。犀利、共鸣、不模板化。', formatRule: '自然地道的中文。现代网络用语OK。', historyHeader: '\n⚠️ 不要重复：\n', linkHeader: '\n📎 参考（仅灵感）：\n', outputRule: '只输出帖子文本。不要介绍/标签。', promptLang: '中文', topicPrefix: '主题：', tonePrefix: '语气：', emojiLabel: '推荐表情：', rulesLabel: '规则：', writeLabel: '写帖子：' },
  ko: { system: '당신은 바이럴 콘텐츠를 만드는 크리에이터입니다.', formatRule: '자연스러운 한국어. 현대적 인터넷 언어.', historyHeader: '\n⚠️ 반복 금지:\n', linkHeader: '\n📎 컨텍스트 (영감만):\n', outputRule: '게시물 텍스트만 출력.', promptLang: '한국어', topicPrefix: '주제:', tonePrefix: '톤:', emojiLabel: '추천 이모지:', rulesLabel: '규칙:', writeLabel: '게시물 작성:' },
  ja: { system: 'あなたはバイラルコンテンツを作成する日本語クリエイターです。', formatRule: '自然な日本語。現代ネット言葉OK。', historyHeader: '\n⚠️ 繰り返さないで：\n', linkHeader: '\n📎 コンテキスト（参考のみ）：\n', outputRule: '投稿テキストのみ出力。', promptLang: '日本語', topicPrefix: 'トピック：', tonePrefix: 'トーン：', emojiLabel: 'おすすめ絵文字：', rulesLabel: 'ルール：', writeLabel: '投稿を書く：' },
  ru: { system: 'Ты создатель вирусного контента. Пишешь остро, relatable.', formatRule: 'Естественный русский. Современный интернет-язык.', historyHeader: '\n⚠️ НЕ повторять:\n', linkHeader: '\n📎 КОНТЕКСТ (вдохновение):\n', outputRule: 'Только текст поста.', promptLang: 'Русский', topicPrefix: 'ТЕМА:', tonePrefix: 'ТОН:', emojiLabel: 'ПОДХОДЯЩИЕ ЭМОДЗИ:', rulesLabel: 'ПРАВИЛА:', writeLabel: 'НАПИШИ ПОСТ:' },
  nl: { system: 'Je maakt virale content. Scherp, relatable, natuurlijk.', formatRule: 'Natuurlijk Nederlands. Modern, niet stijf.', historyHeader: '\n⚠️ NIET HERHALEN:\n', linkHeader: '\n📎 CONTEXT (inspiratie):\n', outputRule: 'ALLEEN de post-tekst.', promptLang: 'Nederlands', topicPrefix: 'ONDERWERP:', tonePrefix: 'TOON:', emojiLabel: 'PASSENDE EMOJI:', rulesLabel: 'REGELS:', writeLabel: 'SCHRIJF POST:' },
  ms: { system: 'Anda pencipta kandungan viral. Tajam, relatable, semula jadi.', formatRule: 'Bahasa Melayu natural. "aku" bukan "saya".', historyHeader: '\n⚠️ JANGAN ULANG:\n', linkHeader: '\n📎 KONTEKS (inspirasi):\n', outputRule: 'HANYA teks postingan.', promptLang: 'Melayu', topicPrefix: 'TOPIK:', tonePrefix: 'NADA:', emojiLabel: 'EMOJI SESUAI:', rulesLabel: 'PERATURAN:', writeLabel: 'TULIS POSTINGAN:' },
  su: { system: 'Manéh nyieun kontén viral. Seukeut, relatable, natural.', formatRule: 'Basa Sunda loma natural. "urang/manéh".', historyHeader: '\n⚠️ ULAH DIULANG:\n', linkHeader: '\n📎 KONTEKS (inspirasi):\n', outputRule: 'WAUNG téks postingan.', promptLang: 'Sunda', topicPrefix: 'JEJER:', tonePrefix: 'NADA:', emojiLabel: 'EMOJI COCOG:', rulesLabel: 'ATURAN:', writeLabel: 'JIEUN POSTINGAN:' },
  jv: { system: 'Kowé nggawé kontén viral. Landhep, relatable, alami.', formatRule: 'Basa Jawa ngoko alami. "aku/kowé".', historyHeader: '\n⚠️ OJO MBALÈNI:\n', linkHeader: '\n📎 KONTEKS (inspirasi):\n', outputRule: 'MUNG téks postingan.', promptLang: 'Jawa', topicPrefix: 'BAB:', tonePrefix: 'NADA:', emojiLabel: 'EMOJI COCOG:', rulesLabel: 'ATURAN:', writeLabel: 'GAWÉ POSTINGAN:' },
};

function getLC(lang) { return LANG_CONFIG[lang] || LANG_CONFIG.id; }

function buildPrompt(topic, tone, history, linkContent, lang) {
  const lc = getLC(lang);
  const t = TONE_EMOJI_MAP[tone] || TONE_EMOJI_MAP.informatif;
  const emojis = t.emoji.join(' ');

  const historyBlock = history.length
    ? lc.historyHeader + history.map((h, i) => `${i + 1}. ${h.slice(0, 80)}`).join('\n')
    : '';
  const linkBlock = (linkContent && linkContent.length > 10)
    ? lc.linkHeader + linkContent.slice(0, 1200)
    : '';

  return `BUAT 1 POSTINGAN THREADS VIRAL — ${lc.promptLang}.

${lc.topicPrefix} ${topic}
${lc.tonePrefix} ${t.desc}
${lc.emojiLabel} ${emojis}

${lc.rulesLabel}
- ${lc.formatRule}
- Maks 280 karakter
- WAJIB: 2-3 emoji dari pilihan di atas, diletakkan natural di tengah kalimat
- Emoji pertama = pembuka mood
- NO hashtag, NO link, NO mention
- Akhiri open loop
${linkBlock}
${historyBlock}

${lc.outputRule}

${lc.writeLabel}`; 
}

export async function generateText(config, keywords, history = [], tone = '', linkContent = '', retries = 3) {
  const lang = config.lang || 'id';
  const topic = keywords[0] || 'trending';
  const toneInput = tone || config.tone || 'informatif';
  const lc = getLC(lang);

  const body = {
    model: 'agnes-2.0-flash',
    messages: [
      { role: 'system', content: lc.system },
      { role: 'user', content: buildPrompt(topic, toneInput, history, linkContent, lang) },
    ],
    max_tokens: 250,
    temperature: 0.88,
  };

  logger.info('[Agnes]', { topic, tone: toneInput, lang });

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openrouterApiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.text();
    throw new Error(`Agnes ${res.status}: ${e.slice(0, 200)}`);
  }
  const data = await res.json();
  let text = data.choices[0].message.content.trim();
  text = text.replace(/^["'""'']|["'""'']$/g, '').trim();
  text = text.replace(/^(Postingan:|Post:|Output:|Here is|Berikut|Ini dia)/i, '').trim();
  return text;
}
