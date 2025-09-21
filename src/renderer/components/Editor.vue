<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue'
  import * as monaco from 'monaco-editor'
  import { MonacoLanguageClient } from 'monaco-languageclient'
  import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc'
  import { CloseAction, ErrorAction } from 'vscode-languageclient'
  import { initVimMode } from 'monaco-vim'
  import { installPHPLanguage, installOutputLanguage, installThemes } from '../editor'
  import { useSettingsStore } from '../stores/settings'
  import { useLspStore } from '../stores/lsp'

  const settingsStore = useSettingsStore()
  const lspStore = useLspStore()

  // Props
  const props = defineProps({
    editorId: {
      type: String,
    },
    language: {
      type: String,
      default: 'php',
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    value: {
      type: String,
      default: '',
    },
    wrap: {
      type: Boolean,
      default: false,
    },
    path: {
      type: String,
    },
    autoFocus: {
      type: Boolean,
      default: false,
    },
  })

  const editorContainer = ref(null)
  const vimMode = ref(null)

  let languageClient: MonacoLanguageClient | null = null
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  const emit = defineEmits(['update:value'])

  // --- STATI PER AI ---
  const isAiThinking = ref(false);
  const aiSuggestions = ref<any[]>([]);
  let thinkingInterval: any = null;
  let ghostTextWidget: any = null;
  // La variabile 'suggestionDebounceTimer' non è più necessaria e può essere rimossa.

  if (props.language === 'php') {
    installPHPLanguage()
  }
  if (props.language === 'output') {
    installOutputLanguage()
  }

  // La logica per il widget "thinking" rimane la stessa
  const initializeThinkingWidget = (editor: monaco.editor.IStandaloneCodeEditor) => {
    ghostTextWidget = {
      getId: () => 'thinking-ghost-text-widget',
      getDomNode: () => {
        const node = document.createElement('span');
        node.className = 'ghost-text ghost-text-thinking';
        const baseText = 'thinking ...';
        const randomChars = '123456789';
        const generateRandomChars = (length = 6) => {
          let result = '';
          for (let i = 0; i < length; i++) {
            result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
          }
          return result;
        };
        node.textContent = ' ' + '000000' + ' ' + baseText;
        clearInterval(thinkingInterval);
        thinkingInterval = setInterval(() => {
          node.textContent = ' ' + generateRandomChars() + ' ' + baseText;
        }, 150);
        return node;
      },
      getPosition: () => {
        const position = editor.getPosition();
        if (!position) return null;
        return {
          position: position,
          preference: [0 /* monaco.editor.ContentWidgetPositioningPreference.INLINE */],
        };
      },
    };
  };

  const showThinkingWidget = () => {
    if (editor && !isAiThinking.value) {
      isAiThinking.value = true;
      editor.addContentWidget(ghostTextWidget);
    }
  }

  const hideThinkingWidget = () => {
    if (editor && isAiThinking.value) {
      isAiThinking.value = false;
      clearInterval(thinkingInterval);
      editor.removeContentWidget(ghostTextWidget);
    }
  }


  onMounted(async () => {
    installThemes()

    if (editorContainer.value) {
      editor = monaco.editor.create(editorContainer.value, {
        readOnly: props.readonly,
        fontSize: settingsStore.settings.editorFontSize,
        inlineSuggest: { enabled: true },
        minimap: { enabled: false },
        wordWrap: settingsStore.settings.editorWordWrap as 'on' | 'off' | 'wordWrapColumn' | 'bounded',
        theme: settingsStore.settings.theme,
        stickyScroll: { enabled: false },
        automaticLayout: true,
        glyphMargin: false,
        scrollBeyondLastLine: false,
        lightbulb: { enabled: 'off' as monaco.editor.ShowLightbulbIconMode },
      })

      initializeThinkingWidget(editor);

      if (settingsStore.settings.vimMode === 'on') {
        vimMode.value = initVimMode(editor)
      }

      const file = `${props.path}/${props.editorId}.${props.language}`
      let editorModel = monaco.editor.getModel(monaco.Uri.file(file))
      if (!editorModel) {
        editorModel = monaco.editor.createModel(props.value, props.language, monaco.Uri.file(file))
      }
      editor.setModel(editorModel)

      const fetchAndTriggerSuggestions = async () => {
        if (!editor) return;

        const model = editor.getModel();
        const position = editor.getPosition();
        if (!model || !position) return;

        const settings = {
          provider: settingsStore.settings.aiProvider,
          apiKey: settingsStore.settings.aiApiKey,
          modelId: settingsStore.settings.aiModelId
        };
        if (!settings.provider || !settings.apiKey || !settings.modelId) return;

        showThinkingWidget();

        try {
          const context = {
            codeBeforeCursor: model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column }),
            codeAfterCursor: model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: model.getLineCount(), endColumn: model.getLineMaxColumn(model.getLineCount()) }),
            currentFileContent: model.getValue()
          };
          const result = await window.ipcRenderer.invoke('ai:get-completion', { settings, context });

          if (result.completions && result.completions.length > 0) {
            const nonEmptySuggestions = result.completions.filter(comp => comp && comp.trim() !== '');

            if (nonEmptySuggestions.length > 0) {
              aiSuggestions.value = nonEmptySuggestions;
              editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
            }
          }
        } catch (error) {
          console.error("AI completion error:", error);
        } finally {
          hideThinkingWidget();
        }
      };

      // --- MODIFICA 1: AGGIUNTA DELL'AZIONE MANUALE ---
      editor.addAction({
        id: 'trigger-ai-completion',
        label: 'Trigger AI Completion',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI], // Ctrl+I on Win/Linux, Cmd+I on Mac
        run: () => {
          if (settingsStore.settings.aiProvider) {
            fetchAndTriggerSuggestions();
          }
        }
      });

      monaco.languages.registerCompletionItemProvider('php', {
        provideCompletionItems() {
          const suggestions = aiSuggestions.value.map((comp: string, index: number) => ({
            label: {
              label: (comp.split('\n')[0].trim() || `Suggerimento AI #${index + 1}`),
              description: `AI`
            },
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: comp,
            documentation: {
              value: '```php\n' + comp + '\n```',
              isTrusted: true,
            },
            range: new monaco.Range(editor!.getPosition()!.lineNumber, editor!.getPosition()!.column, editor!.getPosition()!.lineNumber, editor!.getPosition()!.column),
            sortText: `a_${index}`
          }));
          aiSuggestions.value = [];
          return { suggestions: suggestions };
        }
      });

      // --- MODIFICA 2: RIMOZIONE DEL TRIGGER AUTOMATICO ---
      editor.onDidChangeModelContent(() => {
        emit('update:value', editor!.getValue());
        // La logica del timer è stata rimossa.
      });

      if (props.autoFocus) {
        focusEditor()
      }

      if (window.platformInfo.getPlatform() !== 'win32' && !props.readonly && props.path && props.language === 'php') {
        const interval = setInterval(async () => {
          try {
            await createWebSocketClient(`ws://127.0.0.1:${import.meta.env.VITE_LSP_WEBSOCKET_PORT}`)
            clearInterval(interval)
          } catch (error) {
            console.error('WebSocket connection failed, retrying...', error)
          }
        }, 1000)
      }
    }
  })

  onBeforeUnmount(async () => {
    lspStore.setDisconnected()
    clearInterval(thinkingInterval);

    if (editor) {
      if (vimMode.value) {
        vimMode.value.dispose()
      }
      editor.dispose()
    }
    if (languageClient && languageClient.isRunning()) {
      if (languageClient) {
        await languageClient.stop()
      }
      await languageClient.dispose()
    }
  })

  const updateValue = (value: any) => {
    if (editor) {
      editor.setValue(value)
    }
  }

  const focusEditor = () => {
    if (editor) {
      const model = editor.getModel()
      if (model) {
        const lineCount = model.getLineCount()
        const lastLine = model.getLineContent(lineCount)
        const lastColumn = lastLine.length + 1

        editor.setPosition({
          lineNumber: lineCount,
          column: lastColumn,
        })

        editor.focus()
      }
    }
  }

  const reconnectLsp = async () => {
    if (languageClient && languageClient.isRunning()) {
      await languageClient.stop()
      await languageClient.dispose()
    }

    await createWebSocketClient(`ws://127.0.0.1:${import.meta.env.VITE_LSP_WEBSOCKET_PORT}`)
  }

  const createWebSocketClient = (url: string) => {
    return new Promise<void>((resolve, reject) => {
      lspStore.setConnecting()
      const webSocket = new WebSocket(url)

      webSocket.onopen = async () => {
        const socket = toSocket(webSocket)
        const messageTransports = {
          reader: new WebSocketMessageReader(socket),
          writer: new WebSocketMessageWriter(socket),
        }
        languageClient = createLanguageClient(messageTransports)

        messageTransports.reader.onClose(async () => {
          if (languageClient) {
            await languageClient.stop()
          }
        })

        try {
          await languageClient.start()
          lspStore.setConnected()
        } catch (e) {
          lspStore.setDisconnected()
        }
        resolve()
      }

      webSocket.onerror = error => {
        lspStore.setDisconnected()
        reject(error)
      }

      webSocket.onclose = () => {
        lspStore.setDisconnected()
      }
    })
  }

  const createLanguageClient = (messageTransports: {
    reader: WebSocketMessageReader
    writer: WebSocketMessageWriter
  }) => {
    return new MonacoLanguageClient({
      id: props.editorId,
      name: 'PHP Language Client',
      clientOptions: {
        documentSelector: ['php'],
        workspaceFolder: {
          index: props.editorId,
          name: 'workspace-' + props.editorId,
          uri: monaco.Uri.file(`${props.path}`),
        },
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
      },
      connectionProvider: {
        get: () => Promise.resolve(messageTransports),
      },
    })
  }

  defineExpose({
    updateValue,
    focusEditor,
    reconnectLsp,
  })
</script>

<template>
  <div ref="editorContainer" class="w-full h-full"></div>
</template>