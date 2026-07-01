// netlify/functions/openrouter.js — Agnes AI (free, OpenAI-compatible)
// Multi-language support: id, en, zh, ko, ja, ru, nl, ms
import { logger } from './logger.js';

const BASE_URL = 'https://apihub.agnes-ai.com/v1';

// ── Language config map ──────────────────────────────────────────
const LANG_CONFIG = {
  id: {
    system: 'Kamu content creator Indonesia jago bikin postingan viral di Threads.',
    topicLine: (t) => 'Buat satu postingan pendek (maks 280 karakter) tentang "' + t + '".\n',
    instruction: 'Bahasa Indonesia natural dan engaging. Maks 280 karakter. NO hashtag, NO kutipan di awal/akhir. Output HANYA teks postingan jadi, jangan ada intro/outro lain.',
    historyHeader: '\nJANGAN ulangi postingan sebelumnya:\n',
    linkHeader: '\nKONTEKS DARI LINK (jadikan inspirasi, JANGAN copy-paste mentah — tulis ulang dengan gaya sendiri):\n',
    tonePrefix: 'Gunakan ',
  },
  en: {
    system: 'You are a viral Threads content creator who writes engaging short posts.',
    topicLine: (t) => 'Create a short post (max 280 characters) about "' + t + '".\n',
    instruction: 'Write in NATURAL, ENGAGING English. Max 280 characters. NO hashtags, NO quotes at beginning/end. Output ONLY the final post text, no intro/outro.',
    historyHeader: '\nDO NOT repeat previous posts:\n',
    linkHeader: '\nCONTEXT FROM LINK (use as inspiration, DO NOT copy-paste — rewrite in your own style):\n',
    tonePrefix: 'Use ',
  },
  zh: {
    system: '你是一个在 Threads 上创作病毒式传播内容的中文创作者。',
    topicLine: (t) => '写一篇关于"' + t + '"的短文（最多280字符）。\n',
    instruction: '使用自然、有吸引力的中文。最多280字符。不要使用话题标签，不要在开头/结尾使用引号。只输出最终帖子文本，不要有其他介绍或结尾。',
    historyHeader: '\n不要重复之前的帖子：\n',
    linkHeader: '\n链接内容（作为灵感，不要直接复制粘贴——用自己的风格重写）：\n',
    tonePrefix: '使用',
  },
  ko: {
    system: '당신은 Threads에서 바이럴 콘텐츠를 만드는 한국어 크리에이터입니다.',
    topicLine: (t) => '"' + t + '"에 대한 짧은 글(최대 280자)을 작성하세요.\n',
    instruction: '자연스럽고 매력적인 한국어로 작성하세요. 최대 280자. 해시태그 금지, 시작/끝에 따옴표 금지. 최종 게시물 텍스트만 출력하고 다른 소개/맺음말은 넣지 마세요.',
    historyHeader: '\n이전 게시물을 반복하지 마세요:\n',
    linkHeader: '\n링크 컨텍스트 (영감으로 사용, 그대로 복사하지 말고 자신의 스타일로 다시 작성):\n',
    tonePrefix: '사용: ',
  },
  ja: {
    system: 'あなたはThreadsでバイラルコンテンツを作成する日本語クリエイターです。',
    topicLine: (t) => '「' + t + '」について短い投稿（最大280文字）を作成してください。\n',
    instruction: '自然で魅力的な日本語で書いてください。最大280文字。ハッシュタグ禁止、先頭/末尾の引用符禁止。最終的な投稿テキストのみを出力し、前置きやまとめは不要です。',
    historyHeader: '\n以前の投稿を繰り返さないでください：\n',
    linkHeader: '\nリンクのコンテキスト（インスピレーションとして使用し、コピペせず自分のスタイルで書き直してください）：\n',
    tonePrefix: '使用: ',
  },
  ru: {
    system: 'Ты русскоязычный создатель вирусного контента для Threads.',
    topicLine: (t) => 'Напиши короткий пост (макс 280 символов) на тему "' + t + '".\n',
    instruction: 'Пиши на естественном, увлекательном русском языке. Макс 280 символов. БЕЗ хештегов, БЕЗ кавычек в начале/конце. Только готовый текст поста, без вступлений и заключений.',
    historyHeader: '\nНЕ повторяй предыдущие посты:\n',
    linkHeader: '\nКОНТЕКСТ ИЗ ССЫЛКИ (используй как вдохновение, НЕ копируй — перепиши в своём стиле):\n',
    tonePrefix: 'Используй ',
  },
  nl: {
    system: 'Je bent een Nederlandse content creator die virale posts maakt voor Threads.',
    topicLine: (t) => 'Schrijf een korte post (max 280 tekens) over "' + t + '".\n',
    instruction: 'Schrijf in natuurlijk, boeiend Nederlands. Max 280 tekens. GEEN hashtags, GEEN aanhalingstekens aan begin/eind. Output ALLEEN de uiteindelijke post-tekst, geen intro/outro.',
    historyHeader: '\nHerhaal eerdere posts NIET:\n',
    linkHeader: '\nCONTEXT VAN LINK (gebruik als inspiratie, NIET kopiëren — herschrijf in eigen stijl):\n',
    tonePrefix: 'Gebruik ',
  },
  ms: {
    system: 'Anda seorang pencipta kandungan viral di Threads dalam Bahasa Melayu.',
    topicLine: (t) => 'Buat satu postingan pendek (maks 280 aksara) tentang "' + t + '".\n',
    instruction: 'Bahasa Melayu yang natural dan engaging. Maks 280 aksara. TIADA hashtag, TIADA tanda petik di awal/akhir. Output HANYA teks postingan akhir, tiada intro/outro lain.',
    historyHeader: '\nJANGAN ulangi postingan sebelumnya:\n',
    linkHeader: '\nKONTEKS DARI LINK (jadikan inspirasi, JANGAN salin-tampal — tulis semula dengan gaya sendiri):\n',
    tonePrefix: 'Gunakan ',
  },
};

// ── Tone map (shared across languages — instructions are in Indonesian,
//     but the model understands them regardless of output language) ──
const TONE_MAP = {
  'simpati':        'NADA SIMPATI / MENYENTUH HATI. Cerita relatable yang bikin pembaca terharu, ingin berbuat baik, percaya kebaikan. Hangat, manusiawi. 1 emoji 🥹💚🤝.',
  'debat+solusi':   'NADA DEBAT SEHAT + SOLUSI. Fair & balanced, tunjukkan dua sisi. Ajak diskusi dewasa, kasih sudut pandang membangun. Respectful. No emoji atau 1 maks.',
  'mengejek oknum': 'NADA SATIRE / SINDIRAN CERDAS. Lucu, ngena, elegan — bukan ujaran kebencian. Gaya komedi sosial, ketawa getir. 1 emoji 😏🎭.',
  'marah':          'NADA MARAH / GERAM. Emosi meledak tapi tetap elegan, bukan cacian. Ungkapin kekecewaan atau kemarahan yang justified. 1-2 emoji 😤🤬🔥.',
  'kaget':          'NADA KAGET / SHOCK. Terkejut, tidak percaya, wtf moment. Dramatis tapi tetap engaging. 1-2 emoji 😱🤯💀.',
  'sedih':          'NADA SEDIH / MELANKOLIS. Menyentuh, sendu, bikin pembaca ikut merasakan. Puitis tapi nggak lebay. 1 emoji 😢💔🥀.',
  'bangga':         'NADA BANGGA / CELEBRATORY. Energi positif, uplifting, membanggakan. Rayakan pencapaian atau hal baik. 1-2 emoji 🥳🎉🔥.',
  'takut':          'NADA TAKUT / CEMAS. Bikin merinding, warning, concern yang genuine. Bukan fearmongering. 1 emoji 😨😰⚠️.',
};

// ── Helpers ───────────────────────────────────────────────────────
function getLangConfig(lang) {
  return LANG_CONFIG[lang] || LANG_CONFIG['id']; // fallback to Indonesian
}

function buildPrompt(topic, tone, history, linkContent, lang) {
  const lc = getLangConfig(lang);

  const historyBlock = history.length > 0
    ? lc.historyHeader + history.map((t, i) => (i + 1) + '. ' + t.slice(0, 80)).join('\n')
    : '';

  const linkBlock = linkContent && linkContent.length > 10
    ? lc.linkHeader + linkContent.slice(0, 1500)
    : '';

  const toneInstruction = TONE_MAP[tone] || '';
  const toneBlock = toneInstruction
    ? lc.tonePrefix + toneInstruction + '\n'
    : '';

  return lc.topicLine(topic) +
    toneBlock +
    linkBlock + '\n' +
    lc.instruction +
    historyBlock;
}

// ── Main export ───────────────────────────────────────────────────
export async function generateText(config, keywords, history = [], tone = '', linkContent = '', retries = 3) {
  const lang = config.lang || 'id';
  const topic = keywords[0] || 'trending topic';
  const toneInput = tone || config.tone || '';

  const lc = getLangConfig(lang);
  const prompt = buildPrompt(topic, toneInput, history, linkContent, lang);

  const body = {
    model: 'agnes-2.0-flash',
    messages: [
      { role: 'system', content: lc.system },
      { role: 'user', content: prompt }
    ],
    max_tokens: 300,
    temperature: 0.9,
  };

  logger.info('Agnes AI', { model: body.model, topic, lang });

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
