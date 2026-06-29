// netlify/functions/openrouter.js
import { logger } from './logger.js';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateText(config, keywords, history = [], retries = 3) {
  const systemPrompt = `You are a viral content creator for Threads (Meta's social platform). 

Create a SINGLE Threads post based on trending keywords.
Rules:
- Max 500 characters
- Engaging, thought-provoking, or inspiring
- Use emojis sparingly (1-3 max)
- No hashtags
- Write in a conversational, authentic tone
- Can be in English or Indonesian depending on the context
- Add line breaks for readability
- DO NOT mention you are AI
- Output ONLY the post text, nothing else`;

  const historyText = history.length > 0 
    ? `\n\nRecent posts (DO NOT REPEAT THESE):\n${history.map((h,i) => `${i+1}. "${h}"`).join('\n')}`
    : '';

  const body = {
    model: config.openrouterModel,
    messages: [
      { role: 'system', content: systemPrompt + historyText },
      { role: 'user', content: `Trending keywords: ${keywords.join(', ')}\n\nWrite one compelling Threads post.` }
    ],
    temperature: 0.9,
    max_tokens: 500,
    top_p: 0.95,
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      logger.info(`OpenRouter call attempt ${attempt + 1}/${retries}`);
      
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': 'https://postthreadpost.netlify.app',
          'X-Title': 'Threads Generator',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      
      if (text) {
        logger.info('Text generated', { length: text.length });
        return text;
      }
      
      throw new Error('Empty response from OpenRouter');
    } catch (err) {
      logger.error(`Attempt ${attempt + 1} failed`, { error: err.message });
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}
