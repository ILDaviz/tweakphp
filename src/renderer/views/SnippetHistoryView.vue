<script setup lang="ts">
  import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
  import { Splitpanes, Pane } from 'splitpanes'
  import 'splitpanes/dist/splitpanes.css'
  import Divider from '../components/Divider.vue'
  import Modal from '../components/Modal.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import Editor from '../components/Editor.vue'
  import { Snippet } from '../../types/snippet.type'
  import TextInput from '../components/TextInput.vue'
  import SelectInput from '../components/SelectInput.vue'
  import TagsInput from '../components/TagsInput.vue'
  import { z } from 'zod'
  import { useSettingsStore } from '../stores/settings'
  import { useTabsStore } from '../stores/tabs'
  import { useSnippetStore } from '../stores/snippet'
  import events from '../events'
  import PlusCircleIcon from '@/components/icons/PlusCircleIcon.vue'
  import ArrowPathIcon from '@/components/icons/ArrowPathIcon.vue'
  import TrashIcon from '@/components/icons/TrashIcon.vue'
  import SearchIcon from '@/components/icons/SearchIcon.vue'
  import XCircleIcon from '@/components/icons/XCircleIcon.vue'

  const tabsStore = useTabsStore()
  const snippetStore = useSnippetStore()
  const settingsStore = useSettingsStore()

  const emit = defineEmits<{
    selected: [value: Snippet]
  }>()

  const loadingEdit = ref<boolean>(false)
  const errorResponse = ref<string>('')
  const snippetSelected = ref<Snippet | null>(null)
  const isCreating = ref<boolean>(false)
  const searchQuery = ref<string>('')
  const snippetName = ref('')
  const snippetTags = ref<string[]>([])
  const snippetCode = ref<string>('')
  const snippets = ref<Snippet[] | []>([])
  const snippetTabId = ref<string | number | null>(null)
  const snippetTabName = ref<string | null>(null)
  const searchDebounceTimeout = ref<number | null>(null)
  const sortBy = ref<'last_used_at' | 'updated_at' | 'created_at'>('last_used_at')
  const insertMode = ref<'cursor' | 'replace'>('cursor')
  const selectedTagFilters = ref<string[]>([])
  const deleteSnippetModal = ref()
  const fieldErrors = ref<{
    name?: string
    code?: string
    tags?: string
    id?: string
  }>({})

  type SnippetResponse = {
    error?: string
    data: Snippet[] | []
  }

  const handleLoadedSnippets = (snippetResponses: SnippetResponse) => {
    if (snippetResponses.error) {
      console.error('Error loading snippets:', snippetResponses.error)
      errorResponse.value = snippetResponses.error
      return
    }

    snippets.value = snippetResponses?.data || []
  }

  const sendLoadSnippets = (query: string | null = null) => {
    window.ipcRenderer.send('load-snippets', {
      filter: query,
      sortBy: sortBy.value,
      sortDir: 'desc',
    })
  }

  const clickTimeout = ref<number | null>(null)

  const handleClick = (snippet: Snippet, onlyShow = false) => {
    isCreating.value = false
    snippetSelected.value = snippet
    selectedSnippet()
    if (onlyShow) {
      return
    }
    if (clickTimeout.value !== null) {
      clearTimeout(clickTimeout.value)
      clickTimeout.value = null
      handleUse()
    } else {
      clickTimeout.value = window.setTimeout(() => {
        clickTimeout.value = null
      }, 250) // 250 ms delay for double click detection
    }
  }

  const handleCreate = () => {
    snippetSelected.value = null
    isCreating.value = true
    snippetName.value = ''
    snippetTags.value = []
    snippetCode.value = snippetStore.getCode() || ''
    snippetTabId.value = null
    snippetTabName.value = null
    errorResponse.value = ''
    fieldErrors.value = {}
  }

  const selectedSnippet = () => {
    if (!snippetSelected.value) return
    snippetName.value = snippetSelected.value.name
    snippetTags.value = snippetSelected.value.tags || []
    snippetCode.value = snippetSelected.value.code
    snippetTabId.value = snippetSelected.value.tab_id || null
    snippetTabName.value = snippetSelected.value.tab_name || null
    errorResponse.value = ''
    fieldErrors.value = {}
  }

  watch(searchQuery, newQuery => {
    if (searchDebounceTimeout.value) {
      clearTimeout(searchDebounceTimeout.value)
    }
    searchDebounceTimeout.value = window.setTimeout(() => {
      if (newQuery.trim() === '' || newQuery.length > 1) {
        sendLoadSnippets(newQuery.trim())
      }
    }, 220)
  })

  watch(sortBy, () => {
    sendLoadSnippets(searchQuery.value.trim() || null)
  })

  watch(snippetName, () => {
    if (fieldErrors.value.name) {
      fieldErrors.value.name = undefined
    }
  })

  watch(snippetCode, () => {
    if (fieldErrors.value.code) {
      fieldErrors.value.code = undefined
    }
  })

  watch(snippetTags, () => {
    if (fieldErrors.value.tags) {
      fieldErrors.value.tags = undefined
    }
  })

  watch(
    () => snippetStore.showModal,
    val => {
      if (val) {
        handleCreate()
      }
    }
  )

  onMounted(() => {
    window.ipcRenderer.on('load-snippets.reply', handleLoadedSnippets)
    sendLoadSnippets()
    if (snippetStore.showModal) {
      handleCreate()
    }
    window.ipcRenderer.on('snippet-saved.reply', saveSnippetReply)
    window.addEventListener('keydown', handleGlobalShortcuts)
  })

  onBeforeUnmount(() => {
    window.ipcRenderer.removeListener('load-snippets.reply', handleLoadedSnippets)
    window.ipcRenderer.removeListener('snippet-saved.reply', saveSnippetReply)
    window.removeEventListener('keydown', handleGlobalShortcuts)
    if (searchDebounceTimeout.value) {
      clearTimeout(searchDebounceTimeout.value)
      searchDebounceTimeout.value = null
    }
  })

  const handleDelete = () => {
    if (!snippetSelected.value) return

    const deletingId = snippetSelected.value.id

    window.ipcRenderer.once('delete-snippet.reply', response => {
      if (response.error) {
        console.error('Error deleting snippet:', response.error)
        errorResponse.value = response.error
        return
      }

      snippets.value = snippets.value.filter(snippet => snippet.id !== deletingId)
      snippetSelected.value = null
      deleteSnippetModal.value?.closeModal()
    })

    window.ipcRenderer.send('delete-snippet', deletingId)
  }

  const openDeleteModal = () => {
    if (!snippetSelected.value || isCreating.value) return
    deleteSnippetModal.value?.openModal()
  }

  const handleUse = () => {
    if (!snippetSelected.value) return
    if (!tabsStore.current) return
    const selectedSnippetId = snippetSelected.value.id

    events.dispatchEvent(
      new CustomEvent('insert-snippet', {
        detail: {
          code: snippetSelected.value.code,
          mode: insertMode.value,
        },
      })
    )

    window.ipcRenderer.send('snippet-used', selectedSnippetId)

    emit('selected', snippetSelected.value)
  }

  const snippetSchema = z.object({
    name: z.string().min(1, 'Name cannot be empty'),
    code: z.string().min(1, 'Code cannot be empty'),
    tab_id: z.number().nullable().optional(),
    tab_name: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  })

  const updateSnippetSchema = snippetSchema.extend({
    id: z.number().int().positive('ID must be a positive integer'),
  })

  const setFieldErrorsFromZod = (error: z.ZodError) => {
    const errors: { name?: string; code?: string; tags?: string; id?: string } = {}

    for (const issue of error.errors) {
      const field = String(issue.path[0] || '')
      if (field === 'name' || field === 'code' || field === 'tags' || field === 'id') {
        if (!errors[field]) {
          errors[field] = issue.message
        }
      }
    }

    fieldErrors.value = errors
  }

  const updateSnippet = () => {
    if (!snippetSelected.value) return

    loadingEdit.value = true
    errorResponse.value = ''
    fieldErrors.value = {}

    const payload = {
      id: snippetSelected.value.id,
      name: snippetName.value,
      code: snippetCode.value,
      tab_id: null,
      tab_name: null,
      tags: snippetTags.value,
    }

    const result = updateSnippetSchema.safeParse(payload)

    if (!result.success) {
      setFieldErrorsFromZod(result.error)
      loadingEdit.value = false
      return
    }

    window.ipcRenderer.once('update-snippet.reply', response => {
      if (response.error) {
        loadingEdit.value = false
        console.error('Error updating snippet:', response.error)
        errorResponse.value = response.error
        return
      }
      snippets.value = snippets.value.map(snippet =>
        snippet.id === result.data.id ? { ...snippet, ...result.data } : snippet
      )
      snippetSelected.value = result.data as Snippet
      fieldErrors.value = {}
      loadingEdit.value = false
    })

    window.ipcRenderer.send('update-snippet', result.data)
  }

  const saveSnippet = () => {
    loadingEdit.value = true
    errorResponse.value = ''
    fieldErrors.value = {}

    const payload = {
      code: snippetCode.value,
      name: snippetName.value,
      tab_id: null,
      tab_name: null,
      tags: snippetTags.value,
    }

    const result = snippetSchema.safeParse(payload)

    if (!result.success) {
      setFieldErrorsFromZod(result.error)
      loadingEdit.value = false
      return
    }

    window.ipcRenderer.send('snippet-saved', JSON.parse(JSON.stringify(payload)))
  }

  const saveSnippetReply = (e: any) => {
    loadingEdit.value = false
    if (e.error) {
      errorResponse.value = e.error
    } else {
      fieldErrors.value = {}
      // Add the new snippet to the list
      snippets.value.push(e.data)
      // Select the new snippet
      handleClick(e.data)
      // Close store modal if it was open (to reset state)
      if (snippetStore.showModal) {
        snippetStore.modalClosed()
      }
    }
  }

  const isDirty = computed(() => {
    if (isCreating.value) {
      return snippetName.value.trim().length > 0 || snippetCode.value.trim().length > 0 || snippetTags.value.length > 0
    }

    if (!snippetSelected.value) return false

    return (
      snippetName.value !== snippetSelected.value.name ||
      snippetCode.value !== snippetSelected.value.code ||
      JSON.stringify(snippetTags.value || []) !== JSON.stringify(snippetSelected.value.tags || [])
    )
  })

  const filteredSnippets = computed(() => {
    if (selectedTagFilters.value.length === 0) return snippets.value
    const selectedTags = selectedTagFilters.value.map(tag => tag.toLowerCase())
    return snippets.value.filter(snippet => {
      const snippetTags = (snippet.tags || []).map(tag => tag.toLowerCase())
      return selectedTags.every(tag => snippetTags.includes(tag))
    })
  })

  const snippetEditorPath = computed(() => {
    // Prefer Laravel base path to keep Intelephense context consistent inside snippet modal.
    return settingsStore.settings.laravelPath || tabsStore.current?.path || ''
  })

  const toRgba = (color: string | undefined, alpha: number, fallback = 'rgba(148, 163, 184, 0.15)') => {
    if (!color) return fallback

    const normalized = color.trim()
    if (normalized.startsWith('#')) {
      const hex = normalized.slice(1)
      if (hex.length === 6) {
        const r = Number.parseInt(hex.slice(0, 2), 16)
        const g = Number.parseInt(hex.slice(2, 4), 16)
        const b = Number.parseInt(hex.slice(4, 6), 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
      }
    }

    const rgbMatch = normalized.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i)
    if (rgbMatch) {
      return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`
    }

    return fallback
  }

  const snippetThemeStyles = computed(() => {
    const colors = settingsStore.colors
    const selectionBg = colors['editor.selectionBackground'] || colors.backgroundLight || colors.background
    const selectionBorder = colors['editor.selectionHighlightBorder'] || colors.border || colors.foreground

    return {
      activeFilterChip: {
        borderColor: selectionBorder,
        backgroundColor: toRgba(selectionBg, 0.45),
        color: colors.foreground,
      },
      selectedCard: {
        backgroundColor: toRgba(selectionBg, 0.35),
        borderColor: selectionBorder,
        boxShadow: `inset 0 0 0 1px ${toRgba(selectionBorder, 0.5)}`,
      },
      selectedCardText: {
        color: colors.foreground,
      },
      tagChipActive: {
        borderColor: selectionBorder,
        backgroundColor: toRgba(selectionBg, 0.45),
        color: colors.foreground,
      },
      tagChipInactive: {
        borderColor: toRgba(selectionBorder, 0.45),
        backgroundColor: toRgba(selectionBg, 0.2),
        color: colors.foreground,
      },
      unsavedBadge: {
        borderColor: toRgba(selectionBorder, 0.6),
        backgroundColor: toRgba(selectionBg, 0.35),
        color: colors.foreground,
      },
    }
  })

  const snippetThemeVars = computed(() => {
    const colors = settingsStore.colors
    return {
      '--snippet-hit-bg': toRgba(colors['editor.selectionBackground'] || colors.backgroundLight, 0.4),
      '--snippet-hit-color': colors.foreground,
    }
  })

  const toggleTagFilter = (tag: string) => {
    const index = selectedTagFilters.value.findIndex(selectedTag => selectedTag.toLowerCase() === tag.toLowerCase())
    if (index >= 0) {
      selectedTagFilters.value.splice(index, 1)
      return
    }
    selectedTagFilters.value.push(tag)
  }

  const focusSearch = () => {
    const input = document.getElementById('search') as HTMLInputElement | null
    if (!input) return
    input.focus()
    input.select()
  }

  const handleGlobalShortcuts = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const targetTag = target?.tagName?.toLowerCase() || ''
    const isTypingTarget = ['input', 'textarea', 'select'].includes(targetTag) || target?.isContentEditable

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      focusSearch()
      return
    }

    if (event.key === '/' && !isTypingTarget) {
      event.preventDefault()
      focusSearch()
    }
  }

  const formatUpdatedAt = (date: string) => {
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const escapeHtml = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const highlightMatch = (value: string) => {
    const query = searchQuery.value.trim()
    if (!query) return escapeHtml(value)
    const normalized = escapeHtml(value)
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return normalized.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<mark class="snippet-hit">$1</mark>')
  }
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-4 pb-2" :style="snippetThemeVars">
    <div class="rounded-lg border border-gray-500/25 bg-black/10 px-4 py-3">
      <div class="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
        <div class="flex items-center gap-3">
          <span>{{ filteredSnippets.length }} snippets</span>
          <span>Press `/` or `Ctrl/Cmd+K` to focus search</span>
        </div>
      </div>
      <div v-if="selectedTagFilters.length > 0" class="mb-2 flex items-center gap-2 text-xs text-gray-300">
        <span>Tag filters:</span>
        <span
          v-for="tag in selectedTagFilters"
          :key="`active-filter-${tag}`"
          class="rounded-full border px-2 py-0.5"
          :style="snippetThemeStyles.activeFilterChip"
        >
          {{ tag }}
        </span>
        <button class="rounded px-2 py-0.5 text-gray-300 hover:bg-gray-500/20" @click="selectedTagFilters = []">
          Clear
        </button>
      </div>
      <div class="relative w-full">
        <TextInput
          v-model="searchQuery"
          id="search"
          class="w-full border-2 border-gray-500/20 pl-9 pr-9"
          placeholder="Search snippets..."
        />
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <SearchIcon class="size-4" />
        </span>
        <button
          v-if="searchQuery.length > 0"
          class="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md hover:bg-gray-500/20"
          @click="searchQuery = ''"
        >
          <XCircleIcon class="size-4" />
        </button>
      </div>
    </div>

    <Splitpanes class="default-theme flex-1 min-h-0 gap-4 pb-4 overflow-hidden">
      <Pane size="30" class="!h-full min-w-[360px] rounded-md border-2 border-gray-500/20 p-2">
        <div class="h-full min-h-0 flex flex-col">
          <div class="mb-3 flex items-center justify-end px-1 gap-2">
            <p>Sort by</p>
            <SelectInput v-model="sortBy" class="!border-0 !outline-none !bg-transparent">
              <option value="last_used_at">Last used</option>
              <option value="updated_at">Updated date</option>
              <option value="created_at">Created date</option>
            </SelectInput>
          </div>
          <div class="h-full min-h-0 overflow-y-auto pr-2 custom-scrollbar">
            <div class="flex flex-col gap-2">
              <div
                v-for="snippet in filteredSnippets"
                :key="snippet.id"
                class="relative my-0.5 ml-0.5 flex w-full cursor-pointer items-center justify-between gap-2 rounded border-2 border-gray-500 px-2 py-4 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="[
                  snippetSelected?.id === snippet.id
                    ? 'outline-none ring-2 ring-primary-500 hover:ring-primary-500'
                    : 'hover:border-gray-400',
                ]"
                :style="snippetSelected?.id === snippet.id ? snippetThemeStyles.selectedCard : undefined"
              >
                <button @click="handleClick(snippet)" class="h-full w-full">
                  <span class="flex w-full flex-col items-start justify-start gap-1 text-start">
                    <span
                      :class="[snippetSelected?.id === snippet.id ? 'font-medium' : 'font-medium']"
                      :style="snippetSelected?.id === snippet.id ? snippetThemeStyles.selectedCardText : undefined"
                    >
                      <span v-html="highlightMatch(snippet.name)"></span>
                    </span>
                    <span class="text-xs text-gray-400">{{ formatUpdatedAt(snippet.updated_at) }}</span>
                    <span v-if="snippet.tags?.length" class="mt-1 flex flex-wrap gap-1.5">
                      <span
                        v-for="tag in snippet.tags.slice(0, 3)"
                        :key="`${snippet.id}-tag-${tag}`"
                        class="rounded-full border px-2 py-0.5 text-[10px] transition-colors"
                        :style="
                          selectedTagFilters.some(selectedTag => selectedTag.toLowerCase() === tag.toLowerCase())
                            ? snippetThemeStyles.tagChipActive
                            : snippetThemeStyles.tagChipInactive
                        "
                        @click.stop="toggleTagFilter(tag)"
                      >
                        {{ tag }}
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
          <Divider class="mt-3 mb-2" />
          <p v-if="snippets.length > 0" class="text-sm text-gray-500">
            One click to select a snippet, two clicks to add it to your code editor.
          </p>
        </div>
      </Pane>
      <Pane class="!h-full min-w-[400px] p-2 rounded-md border-2 border-gray-500/20" size="70">
        <div v-if="snippetSelected || isCreating" class="h-full min-h-0 flex flex-col">
          <div class="sticky top-0 z-10 mb-2 rounded-lg border border-gray-500/20 px-3 py-2 shrink-0">
            <div class="mb-2 flex items-start justify-between gap-3">
              <h2 v-if="isCreating" class="text-xl font-semibold leading-tight">
                <span class="text-white">Create New Snippet</span>
              </h2>
              <span v-if="isDirty" class="text-xs px-2 py-1 rounded border" :style="snippetThemeStyles.unsavedBadge">
                Unsaved changes
              </span>
            </div>
            <div v-if="!isCreating" class="mb-2 flex items-center gap-3">
              <span class="text-xs uppercase tracking-wide text-gray-400">Insert mode</span>
              <div class="inline-flex rounded-md border border-gray-500/30 p-1">
                <button
                  type="button"
                  class="rounded px-2 py-1 text-xs transition-colors"
                  :class="insertMode === 'cursor' ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-500/20'"
                  @click="insertMode = 'cursor'"
                >
                  Insert at cursor
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1 text-xs transition-colors"
                  :class="insertMode === 'replace' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-500/20'"
                  @click="insertMode = 'replace'"
                >
                  Replace page
                </button>
              </div>
            </div>
            <div class="flex w-full flex-wrap items-center gap-2">
              <SecondaryButton v-if="!isCreating" @click="handleUse" class="!h-8 !px-3 !border-gray-400/60">
                <div class="flex items-center gap-1">
                  <span>{{ insertMode === 'replace' ? 'Replace with snippet' : 'Insert snippet' }}</span>
                </div>
              </SecondaryButton>
              <PrimaryButton
                v-if="isCreating || isDirty"
                @click="isCreating ? saveSnippet() : updateSnippet()"
                class="!h-8 !px-3 flex items-center gap-1"
                :disabled="loadingEdit"
              >
                <ArrowPathIcon
                  v-if="loadingEdit"
                  :spin="true"
                  class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
                />
                <span>{{ isCreating ? 'Save' : 'Update' }}</span>
              </PrimaryButton>
              <div class="ml-auto">
                <button
                  v-if="!isCreating && snippetSelected"
                  type="button"
                  class="inline-flex h-8 w-8 min-w-0 items-center justify-center rounded-md border border-red-500/70 bg-transparent text-red-400 transition-colors hover:bg-red-500/15"
                  @click="openDeleteModal"
                >
                  <TrashIcon class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex-1 min-h-0 rounded overflow-hidden border-2 border-gray-500/20">
            <Editor
              ref="snippetEdit"
              class="h-full min-h-0 w-full rounded"
              :key="`snippet-edit-${snippetSelected?.id || 'new'}`"
              :editor-id="`snippet-edit-${snippetSelected?.id || 'new'}`"
              v-model:value="snippetCode"
              language="php"
              :wrap="true"
              :path="snippetEditorPath"
              :auto-focus="true"
            />
          </div>
          <div v-if="fieldErrors.code" class="mt-2 shrink-0">
            <span class="text-xs text-red-500">{{ fieldErrors.code }}</span>
          </div>

          <div class="py-2 mb-2 shrink-0">
            <div class="grid grid-cols-1 gap-3 items-center">
              <label for="snippet_name" class="text-xs text-gray-400 uppercase tracking-wide -mb-1">Snippet name</label>
              <TextInput v-model="snippetName" id="snippet_name" placeholder="Snippet name" />
              <span v-if="fieldErrors.name" class="-mt-2 text-xs text-red-500">{{ fieldErrors.name }}</span>
              <label for="snippet_tags" class="text-xs text-gray-400 uppercase tracking-wide -mb-1">Tags</label>
              <TagsInput v-model="snippetTags" id="snippet_tags" placeholder="Add tags and press enter" />
              <span class="-mt-2 text-xs text-gray-400">Use Enter or a comma to add a tag.</span>
              <span v-if="fieldErrors.tags" class="-mt-2 text-xs text-red-500">{{ fieldErrors.tags }}</span>
            </div>
          </div>
          <div v-if="errorResponse" class="mt-2 shrink-0">
            <span v-text="errorResponse" class="text-xs text-red-500"></span>
          </div>
        </div>
        <div v-else class="flex items-center justify-center p-10 h-full text-center">
          <div class="flex flex-col items-center gap-4">
            <p v-if="snippets.length > 0" class="text-sm text-white">Select a snippet from the list to view or edit.</p>
            <p v-else class="text-sm text-gray-500">No snippets available. Create one by clicking the "+" button.</p>
            <PrimaryButton @click="handleCreate" class="flex items-center gap-2">
              <PlusCircleIcon class="w-5 h-5" />
              <span>Create New Snippet</span>
            </PrimaryButton>
          </div>
        </div>
      </Pane>
    </Splitpanes>

    <Modal ref="deleteSnippetModal" title="Delete Snippet" size="lg">
      <p class="text-sm opacity-80 mb-5">
        Are you sure you want to delete <b>{{ snippetSelected?.name }}</b
        >?
      </p>
      <p class="text-sm opacity-80">This action cannot be undone.</p>
      <div class="mt-6 flex justify-end space-x-3">
        <SecondaryButton @click="deleteSnippetModal.closeModal()">Cancel</SecondaryButton>
        <PrimaryButton class="!bg-red-600 hover:!bg-red-700" @click="handleDelete">Delete permanently</PrimaryButton>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(100, 100, 100, 0.5);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(100, 100, 100, 0.8);
  }

  :deep(mark.snippet-hit) {
    background-color: var(--snippet-hit-bg);
    color: var(--snippet-hit-color);
    border-radius: 4px;
    padding: 0 2px;
  }
</style>
