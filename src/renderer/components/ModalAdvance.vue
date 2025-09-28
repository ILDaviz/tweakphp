<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../components/Modal.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'

  const firstModal = ref()
  const secondModal = ref()
</script>

<template>
  <div>
    <PrimaryButton @click="firstModal.openModal()">
      Apri Dialog
    </PrimaryButton>

    <Modal ref="firstModal" title="Impostazioni Avanzate">
      <p class="text-sm opacity-80 mb-5">
        Sei sicuro di voler modificare queste impostazioni?
        <b>Queste modifiche potrebbero influire sul funzionamento dell'applicazione.</b>
      </p>

      <div class="mt-6 flex justify-end space-x-3">
        <SecondaryButton @click="firstModal.closeModal()">
          Chiudi
        </SecondaryButton>
        <PrimaryButton @click="secondModal.openModal()">
          Elimina questo snippet
        </PrimaryButton>
      </div>
    </Modal>

    <Modal ref="secondModal" title="Secondo Dialog">
      <p class="text-sm opacity-80 mb-5">
        Fatto! Hai aperto il secondo dialog!
      </p>
      <div class="flex justify-end">
        <SecondaryButton @click="secondModal.closeModal()">
          Chiudi
        </SecondaryButton>
      </div>
    </Modal>
  </div>
</template>