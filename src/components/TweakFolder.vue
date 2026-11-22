<script setup lang="ts">
import { useTemplateRef } from 'vue'
import type { VNode } from 'vue'
import { rethrowAfterCleanup } from '../utils/vue-error'
import { provideRack, useRackEntry } from './rack-context'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    title: string
    expanded?: boolean
  }>(),
  {
    expanded: true,
  },
)

defineSlots<{
  default?: () => VNode[]
}>()

const anchorRef = useTemplateRef<HTMLElement>('anchor')

const mountRack = provideRack(anchorRef)

let savedExpanded: boolean | undefined

useRackEntry(anchorRef, (rack, index, updateErrors) => {
  const folder = rack.addFolder({
    ...props,
    expanded: savedExpanded ?? props.expanded,
    index,
  })

  try {
    const unmount = mountRack(folder, updateErrors)
    return {
      blade: folder,
      dispose() {
        // The native folder can be rebuilt while this Vue component stays mounted.
        savedExpanded = folder.expanded
        try {
          unmount()
        } finally {
          folder.dispose()
        }
      },
    }
  } catch (error) {
    rethrowAfterCleanup(
      error,
      () => folder.dispose(),
      'Failed to mount and dispose Tweakpane folder',
    )
  }
})
</script>

<template>
  <div ref="anchor">
    <slot />
  </div>
</template>
