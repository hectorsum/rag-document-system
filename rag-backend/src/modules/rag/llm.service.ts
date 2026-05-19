import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT =
  "You are a precise document assistant. Answer questions using ONLY " +
  "the document context provided. If the answer is not in the context, " +
  "respond with: 'I could not find the answer in the uploaded documents.' " +
  "Always end your answer with: Source: [document name]";

export interface LlmResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client: Anthropic;

  constructor(private config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async generateAnswer(context: string, question: string): Promise<LlmResult> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }],
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    this.logger.log(`LLM call — input: ${inputTokens}, output: ${outputTokens}`);

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected content type from Claude');
    return { text: block.text, inputTokens, outputTokens };
  }

  async generateAnswerStream(
    context: string,
    question: string,
    onChunk: (text: string) => void,
  ): Promise<{ inputTokens: number; outputTokens: number }> {
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = this.client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text);
      }
      if (event.type === 'message_start') inputTokens = event.message.usage.input_tokens;
      if (event.type === 'message_delta') outputTokens = event.usage.output_tokens;
    }

    this.logger.log(`LLM stream — input: ${inputTokens}, output: ${outputTokens}`);
    return { inputTokens, outputTokens };
  }
}
