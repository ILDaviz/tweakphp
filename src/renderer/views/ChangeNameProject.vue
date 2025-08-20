<script setup lang="ts">
  import { ref, watch } from 'vue'
  import TextInput from '../components/TextInput.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import { useTabsStore } from '@/stores/tabs'

  const tabsStore = useTabsStore()

  const emit = defineEmits(['opened'])

  const editedName = ref(tabsStore.current.name)

  watch(
    () => tabsStore.current.name,
    newName => {
      editedName.value = newName
    }
  )

  const handleSave = () => {
    if (editedName.value.trim()) {
      console.log('Tab name updated to:', editedName.value)
      tabsStore.updateTabName(tabsStore.current?.id, editedName.value)
      emit('opened')
    }
  }

  const handleClose = () => {
    emit('opened')
  }
</script>

<template>
  <div>
    <div>
      <label for="tabName" class="block text-sm font-medium text-gray-300 mb-2">Tab Name</label>
      <TextInput id="tabName" v-model="editedName" @keyup.enter="handleSave" placeholder="Enter a new name" />
    </div>
    <div class="mt-6 flex justify-end space-x-3">
      <SecondaryButton @click="handleClose">Cancel</SecondaryButton>
      <PrimaryButton @click="handleSave">Save</PrimaryButton>
    </div>
  </div>
</template>
