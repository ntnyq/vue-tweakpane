<script setup lang="ts">
import type { TpPluginBundle } from 'tweakpane'
import { useTemplateRef } from 'vue'
import type { VNode } from 'vue'
import { useTweakpane } from '../composables'
import { provideRack } from './rack-context'

const props = withDefaults(
  defineProps<{
    title?: string
    expanded?: boolean
    plugins?: readonly TpPluginBundle[]
  }>(),
  { expanded: true },
)

defineSlots<{
  default?: () => VNode[]
}>()

const hostRef = useTemplateRef<HTMLElement>('host')
const anchorRef = useTemplateRef<HTMLElement>('anchor')

const mountRack = provideRack(anchorRef)

useTweakpane(hostRef, {
  ...(props.title === undefined ? {} : { title: props.title }),
  expanded: props.expanded,
  configure(pane) {
    for (const plugin of props.plugins ?? []) {
      pane.registerPlugin(plugin)
    }
    return mountRack(pane)
  },
})
</script>

<template>
  <div>
    <div ref="host"></div>
    <div
      ref="anchor"
      hidden
    >
      <slot />
    </div>
  </div>
</template>
