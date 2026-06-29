import type { Config } from './config.js';
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface ChatResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare class OpenRouterClient {
    private readonly config;
    constructor(config: Config);
    chat(messages: ChatMessage[], maxTokens?: number): Promise<string>;
}
//# sourceMappingURL=openrouter.d.ts.map