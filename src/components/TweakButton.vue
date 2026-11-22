<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useRackEntry } from './rack-context'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  title: string
}>()
const emit = defineEmits<{
  click: []
}>()

const anchorRef = useTemplateRef<HTMLElement>('anchor')

useRackEntry(anchorRef, (rack, index) => {
  const button = rack.addButton({ title: props.title, index })
  const { emitter } = button.controller.buttonController
  // Suppress Vue click events after the native button is disposed.
  const buttonDisposedState = button.controller.viewProps.value('disposed')

  function onClick() {
    if (!buttonDisposedState.rawValue) {
      emit('click')
    }
  }

  // Tweakpane wraps ButtonApi listeners, so ButtonApi.off cannot remove them.
  emitter.on('click', onClick)

  return {
    blade: button,

    dispose() {
      emitter.off('click', onClick)
      button.dispose()
    },
  }
})
</script>

<template>
  <span ref="anchor"></span>
</template>
