/** Multimodal content part, shape-compatible with the OpenAI chat API. */
export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url';
      image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
    };

export interface OpenRouterChatOptions {
  /** Ordered cascade. The first entry becomes `model`, the whole list is sent as `models`. */
  models?: string[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  /** OpenRouter routing extension, e.g. `{ sort: 'throughput' }`. */
  provider?: { sort?: 'price' | 'throughput' | 'latency'; [key: string]: any };
}

export interface OpenRouterResult<T> {
  data: T;
  cost: number;
  /**
   * The model that actually served the request. This is the only way to tell,
   * after the fact, which free model produced a given output in production.
   */
  model: string;
  latencyMs: number;
}

export interface OpenRouterImageResult {
  imagePath: string;
  cost: number;
  model: string;
  latencyMs: number;
}
