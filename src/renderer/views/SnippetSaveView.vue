<script setup lang="ts">
  import Container from '../components/Container.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import Divider from '../components/Divider.vue'
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import ArrowPathIcon from '../components/icons/ArrowPathIcon.vue'
  import TextInput from '../components/TextInput.vue'
  import { useTabsStore } from '../stores/tabs'

  const emit = defineEmits(['saved'])
  const tabsStore = useTabsStore()

  const loading = ref<boolean>(false)
  const errorResponse = ref<string>('')
  const name = ref('')

  const saveSnippet = async () => {
    loading.value = true
    errorResponse.value = ''
    window.ipcRenderer.send('snippet-saved', {
      code: tabsStore.current?.code || '',
      name: name.value,
      tab_id: tabsStore.current?.id || 0,
      tab_name: tabsStore.current?.name || '',
    })
  }

  const saveSnippetReply = (e: any) => {
    loading.value = false
    if (e.error) {
      errorResponse.value = e.error
    } else {
      name.value = ''
      emit('saved', e.snippet)
    }
  }

  onMounted(() => {
    window.ipcRenderer.on('snippet-saved.reply', saveSnippetReply)
  })

  onBeforeUnmount(() => {
    window.ipcRenderer.removeListener('snippet-saved.reply', saveSnippetReply)
  })
</script>

<template>
  <Container>
    <div class="mt-3 w-full mx-auto">
      <div class="mx-auto space-y-3">
        <div class="space-y-3">
          <div class="grid grid-cols-2 items-center">
            <div>Name snippet</div>
            <TextInput id="name_snippet" v-model="name" />
          </div>

          <Divider />
          <div class="flex items-center justify-end">
            <PrimaryButton @click="saveSnippet" :disabled="loading">
              <ArrowPathIcon
                v-if="loading"
                :spin="true"
                class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
              />
              Save snippet
            </PrimaryButton>
          </div>
        </div>

        <div class="mt-2">
          <span v-text="errorResponse" class="text-xs text-red-500"></span>
        </div>
      </div>
    </div>
  </Container>
</template>

<style scoped></style>
