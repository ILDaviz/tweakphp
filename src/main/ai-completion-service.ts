import fetch from 'node-fetch';

interface AISettings {
  provider: 'openai' | 'google' | 'openrouter';
  apiKey: string;
}

interface CompletionContext {
  currentFileContent: string;
  codeBeforeCursor: string;
  codeAfterCursor: string;
}

export class AICompletionService {
  public async getCompletions(settings: AISettings, context: CompletionContext): Promise<string[]> {
    if (!settings.apiKey) {
      throw new Error('API Key non configurata.');
    }

    const prompt = this.buildPrompt(context);

    try {
      switch (settings.provider) {
        case 'openai':
          return await this.fetchOpenAI(settings.apiKey, prompt);
        default:
          throw new Error('Provider AI not found.');
      }
    } catch (error) {
      console.error('Error API', error);
      return [];
    }
  }

  private buildPrompt(context: CompletionContext): string {
    return `
      Sei un assistente di programmazione PHP. Completa il seguente codice PHP.
      Fornisci solo il codice da aggiungere, senza spiegazioni.
      Ecco il contesto del file attuale:
      ---INIZIO CODICE---
      ${context.codeBeforeCursor}/*CURSOR*/${context.codeAfterCursor}
      ---FINE CODICE---

      Completa il codice che si troverebbe al posto di /*CURSOR*/:
    `;
  }

  private async fetchOpenAI(apiKey: string, prompt: string): Promise<string[]> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // o un altro modello
        messages: [{ role: 'user', content: prompt }],
        n: 5,
        stop: ['\n'],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Errore API OpenAI: ${response.statusText} - ${errorBody}`);
    }

    const data: any = await response.json();
    return data.choices.map((choice: any) => choice.message.content.trim());
  }
}