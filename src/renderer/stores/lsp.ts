import { defineStore } from 'pinia'
import { ref } from 'vue'

export type LspStatus = 'connected' | 'connecting' | 'disconnected'

export const useLspStore = defineStore('lsp', () => {
  const status = ref<LspStatus>('disconnected')

  function setStatus(newStatus: LspStatus) {
    status.value = newStatus
  }

  function setConnected() {
    status.value = 'connected'
  }

  function setConnecting() {
    status.value = 'connecting'
  }

  function setDisconnected() {
    status.value = 'disconnected'
  }

  return { status, setStatus, setConnected, setConnecting, setDisconnected }
})