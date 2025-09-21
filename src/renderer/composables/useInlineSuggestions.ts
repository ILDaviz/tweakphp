import { ref, watch, type Ref } from 'vue';
import * as monaco from 'monaco-editor';
import { type useSettingsStore } from '../stores/settings';

/**
 * Un composable per gestire i suggerimenti AI inline (ghost text) in un'istanza di Monaco Editor.
 * @param editorRef Un Ref che contiene l'istanza dell'editor di Monaco.
 * @param settingsStore Lo store delle impostazioni per accedere alle configurazioni AI.
 */
export function useInlineSuggestions(
  editorRef: Ref<monaco.editor.IStandaloneCodeEditor | null>,
  settingsStore: ReturnType<typeof useSettingsStore>
) {
  const currentSuggestion = ref<string | null>(null);
  let ghostTextWidget: any = null;
  let suggestionDebounceTimer: any = null;
  const listeners: monaco.IDisposable[] = [];

  const initialize = () => {
    const editor = editorRef.value;
    if (!editor) return;

    initializeGhostTextWidget(editor);
    addKeyActions(editor);

    // Aggiungi listener e salvali per poterli rimuovere in seguito
    listeners.push(
      editor.onDidChangeModelContent(() => {
        if (settingsStore.settings.aiProvider) {
          triggerSuggestion();
        }
      })
    );

    listeners.push(
      editor.onDidChangeCursorPosition(() => {
        clearSuggestion();
      })
    );
  };

  const destroy = () => {
    // Rimuovi tutti i listener per pulire
    listeners.forEach(listener => listener.dispose());
    clearTimeout(suggestionDebounceTimer);
    clearSuggestion();
  };

  const initializeGhostTextWidget = (editor: monaco.editor.IStandaloneCodeEditor) => {
    ghostTextWidget = {
      getId: () => 'ghost-text-widget',
      getDomNode: () => {
        const node = document.createElement('div');
        node.className = 'ghost-text';
        node.textContent = currentSuggestion.value;
        return node;
      },
      getPosition: () => {
        const position = editor.getPosition();
        if (!position) return null;
        return {
          position: position,
          preference: [monaco.editor.ContentWidgetPositioningPreference.INLINE],
        };
      },
    };
  };

  const triggerSuggestion = () => {
    clearTimeout(suggestionDebounceTimer);
    clearSuggestion();
    suggestionDebounceTimer = setTimeout(fetchAndShowSuggestion, 700);
  };

  const fetchAndShowSuggestion = async () => {
    const editor = editorRef.value;
    if (!editor) return;

    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return;

    const context = {
      codeBeforeCursor: model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column }),
      codeAfterCursor: model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: model.getLineCount(), endColumn: model.getLineMaxColumn(model.getLineCount()) }),
      currentFileContent: model.getValue()
    };

    const settings = {
      provider: settingsStore.settings.aiProvider,
      apiKey: settingsStore.settings.aiApiKey,
      modelId: settingsStore.settings.aiModelId
    };

    if (!settings.provider || !settings.apiKey || !settings.modelId) return;

    const result = await window.ipcRenderer.invoke('ai:get-completion', { settings, context });

    if (result.error) {
      console.error('AI Error:', result.error);
      return;
    }

    if (result.completions && result.completions.length > 0) {
      const suggestion = result.completions[0];
      if (suggestion) {
        currentSuggestion.value = suggestion;
        editor.addContentWidget(ghostTextWidget);
      }
    }
  };

  const addKeyActions = (editor: monaco.editor.IStandaloneCodeEditor) => {
    const suggestionVisibleContext = editor.createContextKey('suggestionVisible', false);

    watch(currentSuggestion, (newValue) => {
      suggestionVisibleContext.set(!!newValue);
    });

    listeners.push(
      editor.addAction({
        id: 'accept-ai-suggestion',
        label: 'Accept AI Suggestion',
        keybindings: [monaco.KeyCode.Tab],
        precondition: 'suggestionVisible',
        run: (ed) => {
          const pos = ed.getPosition();
          if (pos && currentSuggestion.value) {
            ed.executeEdits('ai-suggestion', [
              { range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text: currentSuggestion.value },
            ]);
          }
          clearSuggestion();
        },
      })
    );

    listeners.push(
      editor.addAction({
        id: 'dismiss-ai-suggestion',
        label: 'Dismiss AI Suggestion',
        keybindings: [monaco.KeyCode.Escape],
        precondition: 'suggestionVisible',
        run: () => {
          clearSuggestion();
        },
      })
    );
  };

  const clearSuggestion = () => {
    const editor = editorRef.value;
    if (currentSuggestion.value && editor) {
      currentSuggestion.value = null;
      editor.removeContentWidget(ghostTextWidget);
    }
  };

  // Pulisce i suggerimenti se l'utente disabilita la feature dalle impostazioni
  watch(() => settingsStore.settings.aiProvider, (newValue) => {
    if (!newValue) {
      clearTimeout(suggestionDebounceTimer);
      clearSuggestion();
    }
  });

  // Esponiamo le funzioni per inizializzare e distruggere la logica
  return {
    initialize,
    destroy,
  };
}