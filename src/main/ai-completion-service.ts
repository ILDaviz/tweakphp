import fetch from 'node-fetch'
import { getSettings } from './settings.ts'
import { Tab } from '../types/tab.type.ts'

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
  public async getCompletions(
    completionMetadata: AiCompletionMetadata,
    tab: Tab
  ): Promise<{
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

    const prompt = this.buildPrompt(context, tab)

    console.log('Generated Prompt:', prompt)

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

  /**
   * Determines if the user intends to generate code from a comment.
   * This is true if the line immediately preceding the cursor is a comment
   * and the current line is empty.
   * @param context The current editor context.
   */
  private isCommentToCodeScenario(context: CompletionContext): boolean {
    const lines = context.textBeforeCursor.split('\n');

    const currentLine = lines[lines.length - 1];
    if (currentLine.trim() !== '') {
      return false;
    }

    for (let i = lines.length - 2; i >= 0; i--) {
      const lastMeaningfulLine = lines[i].trim();
      if (lastMeaningfulLine !== '') {
        return lastMeaningfulLine.startsWith('//') || lastMeaningfulLine.startsWith('#');
      }
    }

    return false;
  }

  /**
   * Determines if the cursor is currently inside a comment block.
   * @param context The current editor context.
   * @returns `true` if the cursor is inside a comment, otherwise `false`.
   */
  private isInsideComment(context: CompletionContext): boolean {
    const textBeforeCursor = context.textBeforeCursor

    const lastMultiLineStart = textBeforeCursor.lastIndexOf('/*')
    const lastMultiLineEnd = textBeforeCursor.lastIndexOf('*/')

    if (lastMultiLineStart > lastMultiLineEnd) {
      return true
    }

    const lines = textBeforeCursor.split('\n')
    const currentLineBeforeCursor = lines[lines.length - 1] || ''
    const singleLineCommentPos = Math.max(currentLineBeforeCursor.indexOf('//'), currentLineBeforeCursor.indexOf('#'))

    return singleLineCommentPos !== -1
  }

  /**
   * Builds an intelligent prompt based on the code context.
   * It recognizes whether the user is writing a comment, writing code,
   * or wants to generate code from a comment.
   */
  private buildPrompt(context: CompletionContext, tab: Tab): string {
    const fullCodeWithCursor = `${context.textBeforeCursor}<cursor>${context.textAfterCursor}`

    const framework = tab.info.name?.toLowerCase() || 'plain php'
    const frameworkVersion = tab.info.version ? ` v${tab.info.version}` : 'an unknown version of framework'
    const phpVersion = tab.info.php_version ? `PHP v${tab.info.php_version}` : 'an unknown PHP version'

    let frameworkGuidelines = `Follow best practices and conventions for ${framework}${frameworkVersion} and ${phpVersion} development.\n`
    if (framework === 'laravel') {
      frameworkGuidelines += `Leverage Laravel's core features, such as its helper functions, Facades, and Collection classes, to write idiomatic and efficient code. Prioritize Eloquent for database interactions and Blade for templating.\n`
    }
    if (framework === 'plain php') {
      frameworkGuidelines += `Focus on writing secure, efficient, and maintainable PHP code. Adhere to PSR standards and best practices for modern PHP development.`
    }

    // Generate code from a comment
    if (this.isCommentToCodeScenario(context)) {
      const lines = context.textBeforeCursor.split('\n')
      const commentLine = lines[lines.length - 2].trim()

      return `
You are an expert PHP developer assisting a user in TweakPHP, a code-tweaking tool similar to Tinker (REPL).
Your task is to translate the following PHP comment into a single, executable line of PHP code.

USER INFO:
${frameworkGuidelines}

INSTRUCTIONS:
1. Generate only the PHP code that fulfills the request in the comment.
2. The result must be pure code only. **DO NOT** include explanations, markdown, or <?php tags.
3. Ensure the generated statement ends with a semicolon (;).

COMMENT TO TRANSLATE:
---START COMMENT---
${commentLine}
---END COMMENT---

Analyze the existing code and provide the PHP code for the <cursor> position:
---CODE START---
${fullCodeWithCursor}
---CODE END---
`
    }
    // Complete a comment
    else if (this.isInsideComment(context)) {
      return `
You are a PHP programming assistant. The user is writing a code comment.

USER INFO:
${frameworkGuidelines}

INSTRUCTIONS:
1. Your sole task is to provide **only the text that should be appended at the <cursor> position** to continue writing the existing comment.
2. **If the comment already has an opening tag (like // or /*), do not add a new one.** Your output should be the content that follows.
3. Write in the same language the user started the comment in.
4. **DO NOT** generate PHP code, but you may use code snippets as examples within the comment.
5. If you believe the comment is already complete, close it with the corresponding closing marker (*/ for multi-line comments).

Example 1:
- User Input: // This function will valida<cursor>
- Expected Output: te the user's email address.

Example 2:
- User Input: // To get a random value, we can use the Str::<cursor>
- Expected Output: random() method.

Example 3:
- User Input: /* This is a block comment that will describe<cursor>
- Expected Output:  the purpose of the following class.

Here is the code and the comment to complete (indicated by <cursor>):
---CODE START---
${fullCodeWithCursor}
---CODE END---
`
    }
    // Complete code (default)
    else {
      return `
You are an expert PHP developer helping a user in TweakPHP, a code-tweaking tool similar to Tinker (REPL).
Your goal is to provide a **brief, focused, and immediately executable** code completion.

USER INFO:
${frameworkGuidelines}

INSTRUCTIONS:
1. Provide **ONLY AND EXCLUSIVELY** the PHP code that should be inserted at the <cursor> marker.
2. **DO NOT** repeat the code the user has already written.
3. Add a semicolon (;) **ONLY IF** your completion finishes a statement that doesn't already have one.
4. **DO NOT** include explanations, comments, markdown, '<?php' or '?>' tags. The result must be pure code only. The result must be pure, raw code only.
5. **DO NOT** include the <cursor> marker in your output.
6. The suggested code must be syntactically valid to continue the existing line or code block.
7. If the completion is ambiguous, provide the most likely and briefest possible completion.
8. **IMPORTANT**: If the user has already typed an operator like -> or ::, your task is to provide only what comes after it.
9. **IMPORTANT**: If the line of code at the cursor is already syntactically complete (e.g., ends with ';', '{', or '}') and no further logical completion is possible, **you MUST return an empty string**.

Example 1:
- User Input: $user = new User(); $user->get<cursor>
- Expected Output: Name()

Example 2:
- User Input: str_re<cursor>
- Expected Output: place()

Example 3:
- User Input: echo "Hello"<cursor>
- Expected Output: ;

Example 4:
- User Input: $casa = App\\Models\\Casa::query()-<cursor>
- Expected Output: >where('id', 1)->first();

Example 5:
- User Input: return view('welcome')<cursor>
- Expected Output: ;

Example 6:
- User Input: Str::uuid();<cursor>
- Expected Output:

Analyze the following code and provide the exact completion for the <cursor> position:
---CODE START---
${fullCodeWithCursor}
---CODE END---
`
    }
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
        const errorBody = await response.text()
        throw new Error(`OpenRouter API error: ${response.status} - ${response.statusText}. Response: ${errorBody}`)
      }

      const jsonResponse = await response.json()
      return jsonResponse?.choices?.[0]?.message?.content
    } catch (error) {
      throw error
    }
  }
}
