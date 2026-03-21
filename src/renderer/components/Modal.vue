<script setup lang="ts">
  import { ref } from 'vue'
  import { TransitionRoot, TransitionChild, DialogPanel, DialogTitle, Dialog } from '@headlessui/vue'
  import { useSettingsStore } from '../stores/settings.ts'
  import { XMarkIcon } from '@heroicons/vue/24/outline'

  const settingsStore = useSettingsStore()

  const props = defineProps({
    title: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: 'md',
    },
    variant: {
      type: String,
      default: 'default',
    },
  })

  const emits = defineEmits(['close'])

  const isModalOpen = ref(false)
  const closeModal = () => {
    isModalOpen.value = false
    emits('close')
  }

  const openModal = () => {
    isModalOpen.value = true
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <div>
    <TransitionRoot appear :show="isModalOpen" as="template">
      <Dialog as="div" @close="closeModal" class="relative z-50">
        <TransitionChild
          as="template"
          enter="duration-300 ease-out"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="duration-200 ease-in"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div
            class="fixed inset-0"
            :class="{
              'bg-black/25': props.variant === 'default',
              'bg-black/45 backdrop-blur-sm': props.variant === 'snippet',
            }"
          />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto no-scrollbar">
          <div class="flex min-h-full items-start justify-center p-4 text-center pt-20">
            <TransitionChild
              as="template"
              enter="duration-300 ease-out"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="duration-200 ease-in"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel
                class="w-full transform text-left align-middle transition-all border"
                :class="{
                  'rounded-lg p-6': props.variant === 'default',
                  'rounded-xl p-7 shadow-2xl shadow-black/20 h-[88vh] max-h-[88vh] flex flex-col':
                    props.variant === 'snippet',
                  'max-w-md': props.size === 'md',
                  'max-w-lg': props.size === 'lg',
                  'max-w-xl': props.size === 'xl',
                  'max-w-2xl': props.size === '2xl',
                  'max-w-3xl': props.size === '3xl',
                  'max-w-4xl': props.size === '4xl',
                  'max-w-5xl': props.size === '5xl',
                  'max-w-6xl': props.size === '6xl',
                }"
                :style="{
                  backgroundColor: settingsStore.colors.background,
                  color: settingsStore.colors.foreground,
                  borderColor: settingsStore.colors.border,
                }"
              >
                <DialogTitle
                  as="h3"
                  class="leading-6 mb-5 flex items-center justify-between"
                  :class="{
                    'text-lg font-medium': props.variant === 'default',
                    'text-xl font-semibold pb-3 border-b border-gray-500/30': props.variant === 'snippet',
                  }"
                >
                  {{ props.title }}
                  <button
                    class="inline-flex items-center justify-center rounded-md transition-colors"
                    :class="{
                      'p-0 hover:opacity-70': props.variant === 'default',
                      'size-8 border border-gray-500/40 hover:bg-gray-500/10': props.variant === 'snippet',
                    }"
                    @click="closeModal()"
                  >
                    <XMarkIcon class="w-5 h-5 cursor-pointer" />
                  </button>
                </DialogTitle>
                <div :class="{ 'min-h-0 flex-1 overflow-hidden': props.variant === 'snippet' }">
                  <slot></slot>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<style scoped></style>
