<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../components/Modal.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'

  withDefaults(
    defineProps<{
      withSecondaryConfirmModal?: boolean
    }>(),
    {
      withSecondaryConfirmModal: false,
    }
  )

  const emit = defineEmits<{
    submit: void
  }>()

  const firstModal = ref()
  const secondModal = ref()

  const handleSubmit = () => {
    emit('submit')
    firstModal.value.closeModal()
  }
</script>

<template>
  <div>
    <PrimaryButton @click="firstModal.openModal()">
      <slot name="labelPrimaryButton"> Label Primary Button </slot>
    </PrimaryButton>

    <Modal ref="firstModal" title="Impostazioni Avanzate">
      <slot name="firstModalContent"> First Modal Content </slot>
      <div class="mt-6 flex justify-end space-x-3">
        <SecondaryButton @click="firstModal.closeModal()">
          <slot name="labelSecondaryButton"> Close </slot>
        </SecondaryButton>
        <PrimaryButton v-if="withSecondaryConfirmModal" @click="secondModal.openModal()">
          <slot name="labelPrimaryButtonSecondModal"> Open Second Modal </slot>
        </PrimaryButton>
        <PrimaryButton v-else @click="handleSubmit">
          <slot name="labelPrimaryButtonOnlyFirstModal"> Confirm </slot>
        </PrimaryButton>
      </div>
    </Modal>

    <Modal ref="secondModal" title="Secondo Dialog">
      <slot name="secondModalContent"> Second Modal Content </slot>
      <div class="flex justify-end">
        <SecondaryButton @click="handleSubmit">
          <slot name="labelCloseSecondModal"> Close </slot>
        </SecondaryButton>
      </div>
    </Modal>
  </div>
</template>
