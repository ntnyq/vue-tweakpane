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
    const binding = scope.run(() =>
      useTweakBinding(rack, model, { ...props.params, index }),
    )
    return {
      blade: binding?.value ?? null,
      dispose: () => scope.stop(),
    }
  } catch (error) {
    scope.stop()
    throw error
  }
})
</script>

<template>
  <span ref="anchor"></span>
</template>
