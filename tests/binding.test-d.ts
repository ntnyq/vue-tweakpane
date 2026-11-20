import type { Pane } from 'tweakpane'
import { expectTypeOf } from 'vitest'
import { ref } from 'vue'
import { useTweakBinding } from '../src'

declare const pane: Pane

const quality = ref<'low' | 'high'>('low')
useTweakBinding(pane, quality, {
  options: { High: 'high', Low: 'low' },
}).value?.on('change', event => {
  expectTypeOf(event.value).toEqualTypeOf<'low' | 'high'>()
})

useTweakBinding(pane, ref({ x: 0, y: 0 })).value?.on('change', event => {
  expectTypeOf(event.value).toEqualTypeOf<{ x: number; y: number }>()
})

// @ts-expect-error Dates need a writable computed adapter.
useTweakBinding(pane, ref(new Date()))

// @ts-expect-error Read-only monitor bindings have a different synchronization contract.
useTweakBinding(pane, ref(0), { readonly: true })
