import { HistoryCode } from '../../types/history_code.type'
import { ipcMain } from 'electron'
import path from 'path'
import { app } from 'electron'
import { log } from 'console'
import fs from 'fs'

const historysPath = path.join(app.getPath('userData'), 'historys.json')

log('Setting up Historys storage at:', historysPath)

function loadHistorys(): HistoryCode[] {
  try {
    if (!fs.existsSync(historysPath)) {
      fs.writeFileSync(historysPath, JSON.stringify([]))
      return []
    }
    const data = fs.readFileSync(historysPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

function saveHistorys(Historys: HistoryCode[]): void {
  fs.writeFileSync(historysPath, JSON.stringify(Historys, null, 2))
}

export function setupHistory() {
  ipcMain.handle(
    'save-History',
    (_, History: Partial<Omit<HistoryCode, 'id' | 'created_at'>> & { tab_id?: string | null }) => {
      const Historys = loadHistorys()
      const id = Historys.length > 0 ? Math.max(...Historys.map(s => s.id)) + 1 : 1
      const newHistory = {
        id,
        code: History.code || '',
        tab_id: History.tab_id || null,
        tab_name: History.tab_name || '',
        created_at: new Date().toISOString(),
      }
      Historys.push(newHistory)
      saveHistorys(Historys)
      return newHistory
    }
  )

  ipcMain.handle('get-History-pagination', (_, page: number = 1, limit: number = 10): HistoryCode[] => {
    const Historys = loadHistorys()
    const sorted = Historys.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const offset = (page - 1) * limit
    return sorted.slice(offset, offset + limit)
  })

  ipcMain.handle('delete-History', (_, id: number): { changes: number } => {
    let Historys = loadHistorys()
    const initialLength = Historys.length
    Historys = Historys.filter(s => s.id !== id)
    saveHistorys(Historys)
    return { changes: initialLength - Historys.length }
  })

  ipcMain.handle('delete-all-Historys', (): { changes: string } => {
    saveHistorys([])
    return { changes: 'all' }
  })
}
