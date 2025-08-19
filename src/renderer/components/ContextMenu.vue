<script setup lang="ts">
  import { useSettingsStore } from '../stores/settings'
  import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuPortal,
    ContextMenuRoot,
    ContextMenuTrigger,
  } from 'reka-ui'
import { ref } from 'vue'

  const settingsStore = useSettingsStore();

  function handleClick() {
    alert('hello!')
  }

  const hover1 = ref(false);
  const hover2 = ref(false);
  const hover3 = ref(false);

</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="text-sm p-1 w-[200px] -ml-1 z-50 outline focus:!outline-primary-500 rounded-md grid grid-cols-1 gap-1 border shadow-lg"
        :style="{
          backgroundColor: settingsStore.colors.backgroundLight,
          color: settingsStore.colors.foreground,
          outlineColor: settingsStore.colors.border,
          borderColor: settingsStore.colors.border,
        }"
        :side-offset="5"
      >
        <ContextMenuItem
          value="Change Name"
          @click="handleClick"
          @mouseover="hover1 = true"
          @mouseleave="hover1 = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hover1 ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          Change name
        </ContextMenuItem>
        <ContextMenuItem
          value="Go to folder"
          @click="handleClick"
          @mouseover="hover2 = true"
          @mouseleave="hover2 = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hover2 ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          Go to folder
        </ContextMenuItem>
        <ContextMenuSeparator
          class="h-[1px] border-t border-gray-200/20"
        />
        <ContextMenuItem
          value="Remove tab"
          @click="handleClick"
          @mouseover="hover3 = true"
          @mouseleave="hover3 = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hover3 ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          Remove
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>