import { ipcMain } from 'electron'
import path from 'path'
import { app } from 'electron'
import { log } from 'console'
import fs from 'fs'
import { IpcMainEvent } from 'electron'
import { Snippet } from '../../types/snippet.type'

const snippetsPath = path.join(app.getPath('userData'), 'snippets.json')

log('Setting up snippets storage at:', snippetsPath)

function loadSnippets(): Snippet[] {
  try {
    if (!fs.existsSync(snippetsPath)) {
      fs.writeFileSync(snippetsPath, JSON.stringify([]))
      return []
    }
    const data = fs.readFileSync(snippetsPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

function saveSnippets(snippets: Snippet[]): void {
  fs.writeFileSync(snippetsPath, JSON.stringify(snippets, null, 2))
}

export async function setupSnippet() {
  ipcMain.on(
    'snippet-saved',
    (
      event: IpcMainEvent,
      snippet: Partial<Omit<Snippet, 'id' | 'created_at'>> & { tab_id?: string | null; tab_name: string | null }
    ) => {
      try {
        const snippets = loadSnippets()
        const id = snippets.length > 0 ? Math.max(...snippets.map(s => s.id)) + 1 : 1
        const newSnippet = {
          id,
          code: snippet.code || '',
          name: snippet.name || '',
          tab_id: snippet.tab_id || null,
          tab_name: snippet.tab_name || '',
          created_at: new Date().toISOString(),
        }
        snippets.push(newSnippet)
        saveSnippets(snippets)
        event.reply('snippet-saved.reply', {
          snippet: newSnippet,
        })
      } catch (error) {
        event.reply('snippet-saved.reply', {
          error: 'Failed to save snippet',
        })
      }
    }
  )

  ipcMain.on('load-snippets', (event: IpcMainEvent): Snippet[] => {
    try {
      const snippets = loadSnippets()
      event.reply('load-snippets.reply', snippets)
      return snippets
    } catch (error) {
      event.reply('load-snippets.reply', [])
      return []
    }
  })

  ipcMain.on('delete-snippet', (_, id: number): { changes: number } => {
    let snippets = loadSnippets()
    const initialLength = snippets.length
    snippets = snippets.filter(s => s.id !== id)
    saveSnippets(snippets)
    return { changes: initialLength - snippets.length }
  })

  ipcMain.on('delete-all-snippets', (): { changes: string } => {
    saveSnippets([])
    return { changes: 'all' }
  })
}
