import fetch from 'node-fetch';

interface AISettings {
  provider: 'openrouter';
  apiKey: string;
  modelId?: string;
}

interface CompletionContext {
  currentFileContent: string;
  codeBeforeCursor: string;
  codeAfterCursor: string;
}

export class AICompletionService {
  public async getCompletions(settings: AISettings, context: CompletionContext): Promise<string[]> {
    if (!settings.apiKey) {
      throw new Error('API Key is not configured.');
    }

    const prompt = this.buildPrompt(context);

    console.log(settings.provider)

    try {
      switch (settings.provider) {
        case 'openrouter':
          if (!settings.modelId) {
            throw new Error('Model ID not specified for OpenRouter.');
          }
          return await this.fetchOpenRouter(settings.apiKey, settings.modelId, prompt);

        default:
          throw new Error(`AI Provider '${settings.provider}' is not supported.`);
      }
    } catch (error) {
      console.error('Error during API call:', error);
      return [];
    }
  }

  private buildPrompt(context: CompletionContext): string {
    return `
      You are an expert PHP programming assistant. Your primary task is to complete the following PHP code at the /*CURSOR*/ marker.
      Analyze the context of the code before and after the cursor to provide the most logical and accurate completion.
      Provide ONLY the raw PHP code for the completion. Do not include any comments, explanations, markdown formatting, or surrounding text.
      Here is the current file content:
      ---CODE START---
      ${context.codeBeforeCursor}/*CURSOR*/${context.codeAfterCursor}
      ---CODE END---
    `;
  }

  private async fetchOpenRouter(apiKey: string, model: string, prompt: string): Promise<string[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://tweakphp.com',
          'X-Title': 'TweakPHP',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          n: 5,
          stop: ['\n', ' \n', ';\n'],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('OpenRouter API Error Status:', response.status, response.statusText);
        console.error('OpenRouter API Error Body:', errorBody);
        throw new Error(`OpenRouter API Error: ${response.statusText} - ${errorBody}`);
      }

      const data: any = await response.json();
      return data.choices.map((choice: any) => choice.message.content.trim());

    } catch (error) {
      console.error('Errore durante la chiamata a fetchOpenRouter:', error);
      return [];
    }
  }
}