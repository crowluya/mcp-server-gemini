/**
 * OpenRouter Client for MCP Server
 * Provides interface to call Gemini models through OpenRouter
 */

export type ContentPart = { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'video_url'; video_url: { url: string } };

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface OpenRouterResponse {
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

export interface OpenRouterConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

// OpenRouter model mappings for Gemini
export const OPENROUTER_GEMINI_MODELS = {
  // Gemini 2.5 Flash (Thinking)
  'google/gemini-2.5-flash-preview': {
    description: 'Fast thinking model with best price/performance ratio',
    contextWindow: 1000000,
    thinking: true,
    supports: ['vision', 'video', 'function_calling']
  },
  'google/gemini-2.5-flash-exp': {
    description: 'Experimental version of 2.5 Flash',
    contextWindow: 1000000,
    thinking: true,
    supports: ['vision', 'video', 'function_calling']
  },

  // Gemini 3 Flash
  'google/gemini-3-flash-preview': {
    description: 'Latest Gemini 3 Flash model with improved capabilities',
    contextWindow: 1000000,
    thinking: true,
    supports: ['vision', 'video', 'function_calling']
  },

  // Gemini 2.0 Flash
  'google/gemini-2.0-flash-exp': {
    description: 'Fast, efficient model with 1M context window',
    contextWindow: 1000000,
    thinking: false,
    supports: ['vision', 'video', 'function_calling']
  },

  // Gemini 1.5 Pro
  'google/gemini-pro-1.5': {
    description: 'Previous generation pro model with vision',
    contextWindow: 2000000,
    thinking: false,
    supports: ['vision', 'video', 'function_calling']
  },
  'google/gemini-flash-1.5': {
    description: 'Fast model for quick tasks',
    contextWindow: 1000000,
    thinking: false,
    supports: ['vision', 'function_calling']
  },

  // Experimental models
  'google/gemini-exp-1206': {
    description: 'Latest experimental Gemini model',
    contextWindow: 2000000,
    thinking: true,
    supports: ['vision', 'video', 'function_calling']
  }
};

export class OpenRouterClient {
  private config: OpenRouterConfig;
  private baseURL: string;

  constructor(config: OpenRouterConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 120000
    };
    this.baseURL = config.baseURL || 'https://openrouter.ai/api/v1';
  }

  /**
   * Convert base64 data URL to OpenRouter format
   */
  private prepareMediaContent(base64Data: string, mediaType: 'image' | 'video'): ContentPart[] {
    // Check if already in data URL format
    const dataUrlMatch = base64Data.match(/^data:(.+);base64,(.+)$/);
    const mimeType = dataUrlMatch ? dataUrlMatch[1] : `image/${mediaType === 'video' ? 'mp4' : 'jpeg'}`;
    const base64String = dataUrlMatch ? dataUrlMatch[2] : base64Data;

    if (mediaType === 'video') {
      return [{
        type: 'video_url' as const,
        video_url: { url: `data:${mimeType};base64,${base64String}` }
      }];
    }
    return [{
      type: 'image_url' as const,
      image_url: { url: `data:${mimeType};base64,${base64String}` }
    }];
  }

  /**
   * Prepare user content with text and optional media
   */
  prepareUserContent(
    prompt: string,
    images?: string[],
    videos?: string[]
  ): OpenRouterMessage['content'] {
    const content: OpenRouterMessage['content'] = [
      { type: 'text', text: prompt }
    ];

    // Add images
    if (images && images.length > 0) {
      for (const image of images) {
        content.push(...this.prepareMediaContent(image, 'image'));
      }
    }

    // Add videos
    if (videos && videos.length > 0) {
      for (const video of videos) {
        content.push(...this.prepareMediaContent(video, 'video'));
      }
    }

    return content;
  }

  /**
   * Check if model supports a specific feature
   */
  modelSupports(modelId: string, feature: string): boolean {
    const model = OPENROUTER_GEMINI_MODELS[modelId as keyof typeof OPENROUTER_GEMINI_MODELS];
    return model?.supports.includes(feature) || false;
  }

  /**
   * List available models
   */
  listModels(filter?: 'all' | 'thinking' | 'vision' | 'video'): OpenRouterModel[] {
    let models = Object.entries(OPENROUTER_GEMINI_MODELS);

    if (filter && filter !== 'all') {
      models = models.filter(([_, info]) => info.supports.includes(filter));
    }

    return models.map(([id, info]) => ({
      id,
      name: id,
      description: info.description,
      context_length: info.contextWindow,
      pricing: {
        prompt: 0,
        completion: 0
      }
    }));
  }

  /**
   * Generate completion with streaming support
   */
  async generate(params: {
    model: string;
    messages: OpenRouterMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    responseFormat?: { type: 'text' | 'json_object' };
    stream?: boolean;
  }): Promise<OpenRouterResponse> {
    const { model, messages, temperature = 0.7, maxTokens = 2048, topP = 0.95, responseFormat } = params;

    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      response_format: responseFormat
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://github.com/aliargun/mcp-server-gemini',
          'X-Title': 'MCP Server Gemini'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Simple chat completion helper
   */
  async chat(params: {
    model?: string;
    prompt: string;
    systemInstruction?: string;
    images?: string[];
    videos?: string[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: 'text' | 'json_object' };
  }): Promise<{ text: string; usage?: { total_tokens: number } }> {
    const model = params.model || 'google/gemini-2.5-flash-preview';

    const messages: OpenRouterMessage[] = [];

    // Add system instruction if provided
    if (params.systemInstruction) {
      messages.push({
        role: 'system',
        content: params.systemInstruction
      });
    }

    // Add user message with content
    messages.push({
      role: 'user',
      content: this.prepareUserContent(params.prompt, params.images, params.videos)
    });

    const response = await this.generate({
      model,
      messages,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      responseFormat: params.responseFormat
    });

    return {
      text: response.choices[0]?.message?.content || '',
      usage: response.usage ? {
        total_tokens: response.usage.total_tokens
      } : undefined
    };
  }

  /**
   * Test if the API key is valid
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Main MCP Client - uses OpenRouter exclusively
 */
export class MCPClient {
  private openRouterClient: OpenRouterClient;

  constructor(openRouterKey: string, baseURL?: string) {
    this.openRouterClient = new OpenRouterClient({
      apiKey: openRouterKey,
      baseURL
    });
  }

  async chat(params: {
    model?: string;
    prompt: string;
    systemInstruction?: string;
    images?: string[];
    videos?: string[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: 'text' | 'json_object' };
  }): Promise<{ text: string; usage?: { total_tokens: number } }> {
    return await this.openRouterClient.chat(params);
  }

  listModels(filter?: 'all' | 'thinking' | 'vision' | 'video') {
    return this.openRouterClient.listModels(filter);
  }
}
