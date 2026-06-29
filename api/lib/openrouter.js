"use strict";
// src/openrouter.ts — OpenRouter API client
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterClient = void 0;
const errors_js_1 = require("./errors.js");
const logger_js_1 = require("./logger.js");
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
class OpenRouterClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async chat(messages, maxTokens = 600) {
        let res;
        try {
            res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.openrouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/dante4rt/threads-smart-bot',
                    'X-Title': 'Threads Smart Bot',
                },
                body: JSON.stringify({
                    model: this.config.openrouterModel,
                    messages,
                    max_tokens: maxTokens,
                    temperature: 0.85,
                }),
            });
        }
        catch (err) {
            throw new errors_js_1.TransientError(`OpenRouter network error: ${err.message}`);
        }
        if (res.status === 429) {
            throw new errors_js_1.TransientError('OpenRouter rate limit hit', 429);
        }
        if (res.status >= 500) {
            throw new errors_js_1.TransientError(`OpenRouter server error ${res.status}`, res.status);
        }
        if (!res.ok) {
            throw new Error(`OpenRouter API error ${res.status}`);
        }
        const data = (await res.json());
        if (!data.choices.length) {
            throw new Error('OpenRouter returned no choices');
        }
        const content = data.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenRouter returned empty content');
        }
        logger_js_1.logger.debug('OpenRouter response', {
            model: this.config.openrouterModel,
            tokens: data.usage?.total_tokens,
        });
        return content.trim();
    }
}
exports.OpenRouterClient = OpenRouterClient;
