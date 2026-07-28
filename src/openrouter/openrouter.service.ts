import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import {
  getImageModel,
  getOpenRouterApiKey,
  getOpenRouterHeaders,
  getTextModels,
  getVisionModels,
  IMAGE_MODEL_COST,
  OPENROUTER_BASE_URL,
  OPENROUTER_TIMEOUT_MS,
} from './openrouter.config';
import {
  OpenRouterChatOptions,
  OpenRouterContentPart,
  OpenRouterImageResult,
  OpenRouterResult,
} from './openrouter.types';

/** OpenRouter routing extensions that the OpenAI SDK types don't declare. */
type OpenRouterExtras = {
  models?: string[];
  provider?: Record<string, any>;
};

/**
 * Free models frequently wrap JSON in markdown fences even when
 * `response_format: json_object` is requested, so a bare JSON.parse is not
 * enough. Strips fences, then falls back to slicing the outermost braces.
 */
export function parseJsonLoose<T = any>(raw: string): T {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through to the shared error below
      }
    }
    throw new BadRequestException('OpenRouter returned invalid JSON');
  }
}

/** Removes markdown fences and common preambles from a plain-text answer. */
export function stripPlainTextArtifacts(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^```(?:\w+)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^(?:summary|resumo)\s*:\s*/i, '')
    .trim();
}

@Injectable()
export class OpenrouterService {
  private readonly logger = new Logger(OpenrouterService.name);
  private client: OpenAI | null = null;

  /** Cached across calls, unlike OpenaiService which builds a client per request. */
  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: getOpenRouterApiKey(),
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: getOpenRouterHeaders(),
        timeout: OPENROUTER_TIMEOUT_MS,
        maxRetries: 1,
      });
    }
    return this.client;
  }

  /** Free models cost nothing; otherwise trust OpenRouter's own accounting. */
  private computeCost(model: string, usage: any): number {
    if (model.endsWith(':free')) return 0;
    if (typeof usage?.cost === 'number') return usage.cost;
    return 0;
  }

  private buildMessages(
    prompt: string | OpenRouterContentPart[],
    systemPrompt?: string,
  ): any[] {
    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return messages;
  }

  private async callChat(
    models: string[],
    prompt: string | OpenRouterContentPart[],
    options: OpenRouterChatOptions | undefined,
    jsonMode: boolean,
  ): Promise<{ content: string; model: string; usage: any }> {
    const body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming &
      OpenRouterExtras = {
      model: models[0],
      // OpenRouter routes down this list server-side when a provider fails.
      models,
      messages: this.buildMessages(prompt, options?.systemPrompt),
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 4500,
    };

    if (options?.provider) body.provider = options.provider;
    if (jsonMode) body.response_format = { type: 'json_object' };

    const response = await this.getClient().chat.completions.create(body);
    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new BadRequestException(
        'OpenRouter did not return a valid message.',
      );
    }

    return {
      content,
      model: (response as any).model || models[0],
      usage: response.usage,
    };
  }

  /**
   * Client-side cascade on top of OpenRouter's own `models` routing. Needed
   * because server-side routing does not re-route a 200 response carrying
   * unparseable JSON, nor a free-tier daily cap.
   */
  private async withModelCascade<T>(
    models: string[],
    attempt: (remaining: string[]) => Promise<T>,
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < models.length; i++) {
      try {
        return await attempt(models.slice(i));
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `[OpenRouter] model ${models[i]} failed: ${error?.message}`,
        );
      }
    }
    throw lastError;
  }

  async chatJson<T = any>(
    prompt: string | OpenRouterContentPart[],
    options?: OpenRouterChatOptions,
  ): Promise<OpenRouterResult<T>> {
    const models = options?.models ?? getVisionModels();
    const startedAt = Date.now();

    return this.withModelCascade(models, async (remaining) => {
      const { content, model, usage } = await this.callChat(
        remaining,
        prompt,
        options,
        true,
      );
      // Runs inside the cascade so a model that returns structurally valid but
      // unusable JSON is retried against the next model, exactly like a
      // transport failure. Validating after chatJson returns would be too late.
      const data = options?.validate
        ? options.validate(parseJsonLoose<T>(content))
        : parseJsonLoose<T>(content);
      return {
        data,
        cost: this.computeCost(model, usage),
        model,
        latencyMs: Date.now() - startedAt,
      };
    });
  }

  async chatText(
    prompt: string,
    options?: OpenRouterChatOptions,
  ): Promise<OpenRouterResult<string>> {
    const models = options?.models ?? getTextModels();
    const startedAt = Date.now();

    return this.withModelCascade(models, async (remaining) => {
      const { content, model, usage } = await this.callChat(
        remaining,
        prompt,
        options,
        false,
      );
      const text = stripPlainTextArtifacts(content);
      if (!text) {
        throw new BadRequestException('OpenRouter returned an empty summary.');
      }
      return {
        data: text,
        cost: this.computeCost(model, usage),
        model,
        latencyMs: Date.now() - startedAt,
      };
    });
  }

  /**
   * Image editing uses OpenRouter's dedicated /images endpoint, which is not
   * OpenAI-compatible, so this goes through axios rather than the SDK.
   */
  async editImage(
    sourceImagePath: string,
    prompt: string,
    options?: { model?: string; outputDir?: string },
  ): Promise<OpenRouterImageResult> {
    const model = options?.model ?? getImageModel();
    const startedAt = Date.now();
    const base64Source = fs.readFileSync(sourceImagePath).toString('base64');

    const { data } = await axios.post(
      `${OPENROUTER_BASE_URL}/images`,
      {
        model,
        prompt,
        input_references: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${base64Source}` },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${getOpenRouterApiKey()}`,
          'Content-Type': 'application/json',
          ...getOpenRouterHeaders(),
        },
        timeout: OPENROUTER_TIMEOUT_MS,
      },
    );

    const base64Output =
      data?.data?.[0]?.b64_json ?? data?.images?.[0]?.b64_json;
    if (!base64Output) {
      throw new BadRequestException(
        'OpenRouter image response did not contain image data.',
      );
    }

    // Must stay .png — the caller derives the S3 key from this basename.
    const outputPath = path.resolve(
      options?.outputDir ?? '/tmp',
      `${Date.now()}_avatarOR.png`,
    );
    fs.writeFileSync(outputPath, Buffer.from(base64Output, 'base64'));

    return {
      imagePath: outputPath,
      cost: IMAGE_MODEL_COST,
      model,
      latencyMs: Date.now() - startedAt,
    };
  }
}
