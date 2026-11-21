<script setup lang="ts">
import type { BladeApi } from 'tweakpane'
import { useTemplateRef } from 'vue'
import type { Rack } from './rack-context'
import { useRackEntry } from './rack-context'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  create: (rack: Rack, index: number) => BladeApi
}>()

const anchorRef = useTemplateRef<HTMLElement>('anchor')

useRackEntry(anchorRef, (rack, index) => {
  const blade = props.create(rack, index)
  return () => blade.dispose()
})
</script>

<template>
  <span ref="anchor"></span>
</template>
