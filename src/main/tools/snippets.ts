import { ipcMain, IpcMainEvent } from 'electron'
import { db } from '../db/db_manager'
import { Snippet } from '../../types/snippet.type.ts'
import { z } from 'zod'

type SortBy = 'last_used_at' | 'updated_at' | 'created_at'
type SortDir = 'asc' | 'desc'

type LoadSnippetsPayload = {
  filter?: string | null
  sortBy?: SortBy
  sortDir?: SortDir
}

const sortBySchema = z.enum(['last_used_at', 'updated_at', 'created_at'])
const sortDirSchema = z.enum(['asc', 'desc'])

export async function initSnippet() {
  ipcMain.on(
    'snippet-saved',
    (event: IpcMainEvent, snippet: Partial<Omit<Snippet, 'id' | 'created_at' | 'updated_at' | 'last_used_at'>>) => {
      try {
        const createdAt = new Date().toISOString()
        const saveSnippetSql = db.prepare(`
            INSERT INTO snippets (name,code,tags,created_at,updated_at,last_used_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `)

        const snippetSchema = z.object({
          code: z.string().min(1, 'Code cannot be empty'),
          name: z.string().min(1, 'Name cannot be empty'),
          tags: z.array(z.string()).optional(),
        })

        const parsedSnippet = snippetSchema.safeParse(snippet)

        if (!parsedSnippet.success) {
          console.error('Validation failed:', parsedSnippet.error)
          event.reply('snippet-saved.reply', {
            error: parsedSnippet.error.errors.map(e => e.message).join(', '),
          })
          return
        }

        const result = saveSnippetSql.run(
          snippet.name || '',
          snippet.code || '',
          JSON.stringify(snippet.tags || []),
          createdAt,
          createdAt,
          null
        )

        const newSnippet: Snippet = {
          id: result.lastInsertRowid as number,
          name: snippet.name || '',
          code: snippet.code || '',
          tags: snippet.tags ?? [],
          created_at: createdAt,
          updated_at: createdAt,
          last_used_at: null,
        }
        event.reply('snippet-saved.reply', {
          data: newSnippet,
          error: null,
        })
      } catch (error) {
        console.log('Failed to save snippet:', error)
        event.reply('snippet-saved.reply', {
          data: null,
          error: 'Failed to save snippet',
        })
      }
    }
  )

  ipcMain.on('update-snippet', (event: IpcMainEvent, snippet: Partial<Omit<Snippet, 'created_at'>>) => {
    try {
      const updatedAt = new Date().toISOString()
      const getSnippetSql = db.prepare(`
          SELECT created_at, last_used_at
          FROM snippets
          WHERE id = ?
        `)
      const updateSnippetSql = db.prepare(`
          UPDATE snippets
          SET name = ?, code = ?, tags = ?, updated_at = ?
          WHERE id = ?
        `)

      const snippetSchema = z.object({
        id: z.number().int().positive('ID must be a positive integer'),
        name: z.string().min(1, 'Name cannot be empty'),
        code: z.string().min(1, 'Code cannot be empty'),
        tags: z.array(z.string()).optional(),
      })

      const parsedSnippet = snippetSchema.safeParse(snippet)

      if (!parsedSnippet.success) {
        console.error('Validation failed:', parsedSnippet.error)
        event.reply('update-snippet.reply', {
          error: parsedSnippet.error.errors.map(e => e.message).join(', '),
        })
        return
      }

      const previousSnippet = getSnippetSql.get(snippet.id) as { created_at?: string; last_used_at?: string | null }
      updateSnippetSql.run(snippet.name, snippet.code, JSON.stringify(snippet.tags || []), updatedAt, snippet.id)

      const updatedSnippet: Snippet = {
        id: snippet.id as number,
        name: snippet.name as string,
        code: snippet.code as string,
        tags: snippet.tags ?? [],
        created_at: previousSnippet?.created_at || updatedAt,
        updated_at: updatedAt,
        last_used_at: previousSnippet?.last_used_at ?? null,
      }

      event.reply('update-snippet.reply', {
        data: updatedSnippet,
        error: null,
      })
    } catch (error) {
      console.error('Failed to update snippet:', error)
      event.reply('update-snippet.reply', {
        data: null,
        error: 'Failed to update snippet',
      })
    }
  })

  ipcMain.on('snippet-used', (event: IpcMainEvent, id: number) => {
    try {
      const payload = z.object({
        id: z.number().int().positive('ID must be a positive integer'),
      })

      const parsed = payload.safeParse({ id })
      if (!parsed.success) {
        event.reply('snippet-used.reply', {
          data: null,
          error: parsed.error.errors.map(e => e.message).join(', '),
        })
        return
      }

      const usedAt = new Date().toISOString()
      const markUsedSql = db.prepare(`
        UPDATE snippets
        SET last_used_at = ?
        WHERE id = ?
      `)
      markUsedSql.run(usedAt, id)

      event.reply('snippet-used.reply', {
        data: { id, last_used_at: usedAt },
        error: null,
      })
    } catch (error) {
      console.error('Failed to mark snippet as used:', error)
      event.reply('snippet-used.reply', {
        data: null,
        error: 'Failed to mark snippet as used',
      })
    }
  })

  ipcMain.on('load-snippets', (event: IpcMainEvent, payload: string | number | null | LoadSnippetsPayload = null) => {
    try {
      let filter: string | null = null
      let sortBy: SortBy = 'last_used_at'
      let sortDir: SortDir = 'desc'

      if (typeof payload === 'string' || typeof payload === 'number') {
        filter = String(payload)
      } else if (payload && typeof payload === 'object') {
        filter = typeof payload.filter === 'string' ? payload.filter : null
        const parsedSortBy = sortBySchema.safeParse(payload.sortBy)
        const parsedSortDir = sortDirSchema.safeParse(payload.sortDir)
        sortBy = parsedSortBy.success ? parsedSortBy.data : 'last_used_at'
        sortDir = parsedSortDir.success ? parsedSortDir.data : 'desc'
      }

      let query = 'SELECT * FROM snippets WHERE 1=1'
      const params: any = {}

      if (filter) {
        query +=
          ' AND (name LIKE @name COLLATE NOCASE OR tags LIKE @tags COLLATE NOCASE OR code LIKE @code COLLATE NOCASE)'
        params.name = `%${filter}%`
        params.tags = `%${filter}%`
        params.code = `%${filter}%`
      }

      const direction = sortDir === 'asc' ? 'ASC' : 'DESC'
      if (sortBy === 'last_used_at') {
        query += ` ORDER BY last_used_at IS NULL ASC, last_used_at ${direction}`
      } else if (sortBy === 'updated_at') {
        query += ` ORDER BY updated_at ${direction}`
      } else {
        query += ` ORDER BY created_at ${direction}`
      }

      const listSnippetSql = db.prepare(query).all(params)
      event.reply('load-snippets.reply', {
        data: listSnippetSql.map((row: any) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          tags: row.tags ? JSON.parse(row.tags) : [],
          created_at: row.created_at,
          updated_at: row.updated_at,
          last_used_at: row.last_used_at ?? null,
        })) as Snippet[],
        error: null,
      })
    } catch (error) {
      console.error('Failed to load snippets:', error)
      event.reply('load-snippets.reply', {
        data: [],
        error: 'Failed to load snippets',
      })
    }
  })

  ipcMain.on('delete-snippet', (event: IpcMainEvent, id: number) => {
    try {
      const snippetSchema = z.object({
        id: z.number().int().positive('ID must be a positive integer'),
      })

      const parsedSnippet = snippetSchema.safeParse({ id })

      if (!parsedSnippet.success) {
        console.error('Validation failed:', parsedSnippet.error)
        event.reply('delete-snippet.reply', {
          error: parsedSnippet.error.errors.map(e => e.message).join(', '),
        })
        return
      }

      const deleteSnippetSql = db.prepare(`DELETE FROM snippets WHERE id = ?`)
      deleteSnippetSql.run(id)
      event.reply('delete-snippet.reply', {
        data: id,
        error: null,
      })
    } catch (error) {
      console.error('Failed to delete snippet:', error)
      event.reply('delete-snippet.reply', {
        data: null,
        error: 'Failed to delete snippet',
      })
    }
  })

  ipcMain.on('delete-all-snippets', (event: IpcMainEvent) => {
    try {
      const deleteAllSnippetSql = db.prepare(`DELETE FROM snippets`)
      deleteAllSnippetSql.run()
      event.reply('delete-all-snippets.reply', {
        success: true,
        error: null,
      })
    } catch (error) {
      console.error('Failed to delete all snippets:', error)
      event.reply('delete-all-snippets.reply', {
        success: false,
        error: 'Failed to delete all snippets',
      })
    }
  })
}
