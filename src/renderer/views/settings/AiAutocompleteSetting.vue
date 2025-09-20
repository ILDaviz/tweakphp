<script setup lang="ts">
  import Title from '../../components/Title.vue';
  import Divider from '../../components/Divider.vue';
  import { useSettingsStore } from '../../stores/settings';
  import SelectInput from '../../components/SelectInput.vue';
  import TextInput from '../../components/TextInput.vue';
  import { ref } from 'vue';

  const saved = ref(false);
  const settingsStore = useSettingsStore();

  async function getOpenRouterModels() {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');

      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status}`);
      }

      const jsonResponse = await response.json();

      const models = jsonResponse.data;

      console.log(`Trovati ${models.length} modelli.`);

      if (models.length > 0) {
        console.log('Esempio di ID modello:', models[0].id);
      }

      const freeModels = models.filter(model => model.pricing.prompt === "0" && model.pricing.completion === "0");
      console.log('Modelli Gratuiti:', freeModels.map(m => m.id));


      return models;
    } catch (error) {
      console.error("Impossibile estrarre i modelli da OpenRouter:", error);
      return [];
    }
  }

  getOpenRouterModels();

  const saveSettings = () => {
    saved.value = true;
    settingsStore.update();
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  };
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
      <div>AI Provider</div>
      <SelectInput
        id="ai-provider"
        v-model="settingsStore.settings.aiProvider"
        @change="saveSettings()"
        placeholder="Seleziona un provider"
      >
        <option value="openai">OpenAI (ChatGPT)</option>
        <option value="google">Google (Gemini)</option>
        <option value="openrouter">Open Router</option>
      </SelectInput>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>API Key</div>
      <TextInput
        id="api-key"
        type="password"
        v-model="settingsStore.settings.aiApiKey"
        @change="saveSettings()"
        placeholder="Inserisci la tua chiave API"
      />
    </div>
    <Divider class="mt-3" />
    <p class="text-xs opacity-70 mt-3">
      La tua chiave API viene salvata localmente e usata solo per inviare richieste al provider scelto.
    </p>
  </div>
</template>