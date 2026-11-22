<script setup lang="ts">
import type { BladeApi } from 'tweakpane'
import { useTemplateRef } from 'vue'
import { rethrowAfterCleanup } from '../utils/vue-error'
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

  return {
    blade,
    dispose() {
      try {
        blade.dispose()
      } catch (error) {
        // A custom disposer can fail before it releases the native blade.
        rethrowAfterCleanup(
          error,
          () => blade.controller.viewProps.set('disposed', true),
          'Failed to dispose Tweakpane blade',
        )
      }
    },
  }
})
</script>

<template>
  <span ref="anchor"></span>
</template>
