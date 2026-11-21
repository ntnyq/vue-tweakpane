<script setup lang="ts" generic="T extends TweakValue">
import type { BindingParams } from 'tweakpane'
import { effectScope, useTemplateRef } from 'vue'
import { useTweakBinding } from '../composables'
import type { TweakValue } from '../types'
import { useRackEntry } from './rack-context'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  params?: BindingParams & { readonly?: false }
}>()
const model = defineModel<T>({ required: true })

const anchorRef = useTemplateRef<HTMLElement>('anchor')

useRackEntry(anchorRef, (rack, index) => {
  const scope = effectScope(true)

  try {
    scope.run(() => {
      useTweakBinding(rack, model, { ...props.params, index })
    })
  } catch (error) {
    scope.stop()
    throw error
  }

  return () => scope.stop()
})
</script>

<template>
  <span ref="anchor"></span>
</template>
