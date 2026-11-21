<script setup lang="ts">
import { useTemplateRef } from 'vue'
import type { VNode } from 'vue'
import { provideRack, useRackEntry } from './rack-context'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    title: string
    expanded?: boolean
  }>(),
  { expanded: true },
)

defineSlots<{
  default?: () => VNode[]
}>()

const anchorRef = useTemplateRef<HTMLElement>('anchor')
const mountRack = provideRack(anchorRef)

useRackEntry(anchorRef, (rack, index) => {
  const folder = rack.addFolder({ ...props, index })

  try {
    const unmount = mountRack(folder)
    return () => {
      try {
        unmount()
      } finally {
        folder.dispose()
      }
    }
  } catch (error) {
    folder.dispose()
    throw error
  }
})
</script>

<template>
  <div ref="anchor">
    <slot />
  </div>
</template>
