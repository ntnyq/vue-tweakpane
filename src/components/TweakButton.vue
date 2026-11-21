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
  const onClick = () => emit('click')
  button.on('click', onClick)

  return () => {
    button.off('click', onClick)
    button.dispose()
  }
})
</script>

<template>
  <span ref="anchor"></span>
</template>
