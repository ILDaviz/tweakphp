<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useSettingsStore } from '../../stores/settings'
  import SelectInput from '../../components/SelectInput.vue'
  import TextInput from '../../components/TextInput.vue'
  import { useOpenRouter } from '../../composables/useOpenrouter'
  import { ref, onMounted } from 'vue'
  import SwitchInput from '@/components/SwitchInput.vue'

  const saved = ref(false)
  const settingsStore = useSettingsStore()

  const { models, loading, error, fetchModels } = useOpenRouter()

  onMounted(() => {
    if (settingsStore.settings.aiProvider === 'openrouter') {
      fetchModels()
    }
  })

  const onProviderChange = () => {
    if (settingsStore.settings.aiProvider === 'openrouter') {
      fetchModels()
    }
    saveSettings()
  }

  const saveSettings = () => {
    saved.value = true
    settingsStore.update()
    setTimeout(() => {
      saved.value = false
    }, 2000)
  }
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <Title>AI Completion</Title>
      <span :class="{ 'opacity-0': !saved, 'opacity-65': saved }" class="transition-all duration-300">
        Changes Saved
      </span>
    </div>
    <Divider class="mt-3" />

    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Active</div>
      <SwitchInput id="ai-status" v-model="settingsStore.settings.aiStatus" @update:model-value="saveSettings()">
      </SwitchInput>
    </div>

    <Divider class="mt-3" />

    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Provider</div>
      <SelectInput
        id="ai-provider"
        v-model="settingsStore.settings.aiProvider"
        @change="onProviderChange()"
        placeholder="Select the AI provider"
      >
        <option value="openrouter">OpenRouter</option>
      </SelectInput>
    </div>
    <template v-if="settingsStore.settings.aiProvider === 'openrouter'">
      <Divider class="mt-3" />
      <div class="mt-3 grid grid-cols-2 items-center">
        <div>Models</div>
        <div>
          <SelectInput
            id="ai-model"
            v-model="settingsStore.settings.aiModelId"
            @change="saveSettings()"
            placeholder="Select the AI Model"
            :disabled="loading || !!error"
          >
            <option v-if="loading" value="" disabled>Caricamento modelli...</option>
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </SelectInput>
          <p v-if="error" class="text-xs text-red-500 mt-1">Its impossible to fetch models: {{ error }}</p>
        </div>
      </div>
    </template>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>API Key</div>
      <TextInput
        id="api-key"
        type="password"
        v-model="settingsStore.settings.aiApiKey"
        @change="saveSettings()"
        placeholder="Insert your API key here"
      />
    </div>

    <Divider class="mt-3" />
    <p class="text-xs opacity-70 mt-3">
      Your API key is stored locally and only used to send requests to the selected provider.
    </p>
  </div>
</template>
