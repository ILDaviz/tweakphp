import { contextBridge, ipcRenderer } from 'electron'
import os from 'os'

export interface IpcRenderer {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  send: (channel: string, ...args: any[]) => void
  on: (channel: string, callback: (...args: any[]) => void) => void
  removeListener: (channel: string, callback: (...args: any[]) => void) => void
  once: (channel: string, callback: (...args: any[]) => void) => void
}

export interface PlatformInfo {
  getPlatform: () => NodeJS.Platform
}

const ipcRendererHandler: IpcRenderer = {
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args)
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args))
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },
  once: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.once(channel, (_, ...args) => callback(...args))
  },
}

contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererHandler)

contextBridge.exposeInMainWorld('platformInfo', {
  getPlatform: () => os.platform(),
})
