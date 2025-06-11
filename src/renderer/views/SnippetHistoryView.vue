<script setup lang="ts">
  import Divider from '../components/Divider.vue'
  import { onBeforeUnmount, onMounted, Ref, ref } from 'vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import { Splitpanes, Pane } from 'splitpanes'
  import Editor from '../components/Editor.vue'
  import Container from '../components/Container.vue'
  import { Snippet } from '../../types/snippet.type'
  import 'splitpanes/dist/splitpanes.css'

  const emit = defineEmits(['saved'])

  const snippetSelected = ref<Snippet | null>(null)
  const snippets = ref<Snippet[] | []>([])
  const code = ref<string>('')

  onMounted(() => {
    window.ipcRenderer.send('load-snippets')
  })

  const handleLoadedSnippets = (e: any) => {
    console.log('Snippets loaded:', e)
    snippets.value = e || []
  }

  onMounted(() => {
    window.ipcRenderer.on('load-snippets.reply', handleLoadedSnippets)
  })

  onBeforeUnmount(() => {
    window.ipcRenderer.removeListener('load-snippets.reply', handleLoadedSnippets)
  })
</script>

<template>
  <Container>
    <Splitpanes class="pb-6">
      <pane>
        <button v-for="snippet in snippets" :key="snippet.id" 
        class="flex items-center justify-between p-2 gap-2 w-full items-center my-2 border-2 border-gray-500 hover:border-gray-400 cursor-pointer rounded transition-colors duration-200"
          @click="snippetSelected = snippet"
        >
          <div :class="[snippetSelected?.id === snippet.id ? 'text-primary-600' : '']">{{ snippet.name }}</div>
          <div :class="[snippetSelected?.id === snippet.id ? 'text-primary-600 bg-gray-700 px-2 rounded' : 'bg-gray-500 px-2 rounded']">
            {{ snippet.tab_name }}
          </div>
        </button>
      </pane>
      <pane class="!h-auto">
        <div class="flex justify-end gap-2 items-center mb-4">
          <PrimaryButton> 
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
</svg>
            Delete </PrimaryButton>
          <PrimaryButton> Use this code </PrimaryButton>
        </div>
        <Editor
          :key="`snippet-${snippetSelected?.id}`"
          ref="snippetShow"
          class="h-auto"
          language="output"
          :editor-id="`snippet-${snippetSelected?.id}-${Date.now()}`"
          :value="snippetSelected?.code"
          :readonly="true"
          :wrap="true"
        />
      </pane>
    </Splitpanes>
  </Container>
</template>

<style scoped></style>
