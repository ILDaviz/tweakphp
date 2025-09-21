import fetch from 'node-fetch'
import { getSettings } from './settings.ts'

interface CompletionContext {
  language: string
  textBeforeCursor: string
  textAfterCursor: string
  cursorPosition: {
    lineNumber: number
    column: number
  }
}

interface AiCompletionMetadata {
  completionMetadata: CompletionContext
}

export class AICompletionService {
  public async getCompletions(completionMetadata: AiCompletionMetadata): Promise<{
    completion: string | null
    error: string | null
  }> {
    const settings = getSettings()
    const context = completionMetadata.completionMetadata
    if (!settings.aiApiKey) {
      return {
        completion: null,
        error: 'API key is not set.',
      }
    }

    const prompt = this.buildPrompt(context)

    try {
      switch (settings.aiProvider) {
        case 'openrouter':
          if (!settings.aiModelId) {
            return {
              completion: null,
              error: 'AI model ID is not set for OpenRouter.',
            }
          }
          try {
            const response = await this.fetchOpenRouter(settings.aiApiKey, settings.aiModelId, prompt)
            return {
              completion: response,
              error: null,
            }
          } catch (error) {
            console.log('Error fetching OpenRouter completions:', error)
            return {
              completion: null,
              error: (error as Error).message,
            }
          }
        default:
          return {
            completion: null,
            error: 'Unsupported AI provider.',
          }
      }
    } catch (error) {
      console.log('Error fetching AI completions:', error)
      return {
        completion: null,
        error: (error as Error).message,
      }
    }
  }

  private buildPrompt(context: CompletionContext): string {
    return `
      Please complete the following ${context.language} code:
      Use modern ${context.language} practices and hooks where appropriate.
      Your primary task is to complete the following ${context.language} code at the <cursor> marker.
      Analyze the context of the code before and after the cursor to provide the most logical and accurate completion.
      Provide ONLY the raw ${context.language} code for the completion. Do not include any comments, explanations, markdown formatting, or surrounding text <?php or ?> tags.
      
      Here is the current file content:
      —--CODE START---
      ${context.textBeforeCursor}<cursor>${context.textAfterCursor}
      ---CODE END---`
  }

  private async fetchOpenRouter(apiKey: string, model: string, prompt: string): Promise<string> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tweakphp.com',
          'X-Title': 'TweakPHP',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 1024,
        }),
      })

      if (response.status !== 200) {
        throw new Error('OpenRouter API error: ' + response.status + ' - ' + response.statusText)
      }

      return (await response.json()).choices[0].message.content
    } catch (error) {
      throw error
    }
  }
}
