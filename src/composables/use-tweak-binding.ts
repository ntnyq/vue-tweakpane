import type { BindingParams, Pane } from 'tweakpane'
import {
  effectScope,
  getCurrentScope,
  isReadonly,
  nextTick,
  shallowReadonly,
  shallowRef,
  toRaw,
  toValue,
  watch,
} from 'vue'
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import type { Disposable, TweakBindingApi, TweakValue } from '../types'
import { createBindingValue, registerPaneBinding } from '../utils'

/**
 * Synchronizes a writable Vue model with a native Tweakpane input binding.
 *
 * Edits update the model, and model changes refresh the input. The current
 * binding is disposed when the parent changes or the Vue scope stops.
 * Calling the binding's native `dispose()` also stops synchronization.
 *
 * @template T The type of the value stored in the Vue model.
 * @param parent The pane, folder, or tab page that owns the binding. Pass it
 * directly or through a ref or getter. An absent parent leaves the input unbound.
 * @param model The writable ref or writable computed to synchronize. Object
 * values must be plain records.
 * @param params Optional native Tweakpane options for the writable input.
 * @returns A shallow, read-only ref containing the current binding API, or
 * `null` when no binding is available.
 *
 * @example
 * ```ts
 * const speed = ref(0.5)
 * const binding = useTweakBinding(pane, speed, { min: 0, max: 1 })
 * ```
 */
export function useTweakBinding<T extends TweakValue>(
  parent: MaybeRefOrGetter<Pick<Pane, 'addBinding'> | null | undefined>,
  model: Ref<T>,
  params?: BindingParams & { readonly?: false },
): Readonly<ShallowRef<TweakBindingApi<T> | null>> {
  if (isReadonly(model)) {
    throw new TypeError(
      'useTweakBinding requires a writable model. Use a ref or writable computed.',
    )
  }

  const binding = shallowRef<TweakBindingApi<T> | null>(null)
  const scope = getCurrentScope()

  watch(
    () => toRaw(toValue(parent)),
    (rack, _previous, onCleanup) => {
      if (!rack) {
        return
      }

      let active = true
      let cleanup: Disposable | undefined

      function dispose() {
        if (!active) {
          return
        }

        active = false
        const disposeResources = cleanup
        cleanup = undefined
        disposeResources?.()
      }

      onCleanup(dispose)

      const { target, copyValue, hasSameValue } = createBindingValue(
        model.value,
      )
      if (!active) {
        return
      }

      const instance = rack.addBinding(target, 'value', params)
      if (!active) {
        instance.dispose()
        return
      }

      const disposeBinding = instance.dispose.bind(instance)
      const modelScope = scope?.run(effectScope) ?? effectScope(true)
      const unregister = registerPaneBinding(instance.element, dispose)

      cleanup = () => {
        unregister()
        modelScope.stop()
        instance.off('change', onChange)
        try {
          disposeBinding()
        } finally {
          binding.value = null
        }
      }
      instance.dispose = dispose

      let refreshing = false

      function syncFromModel(value: T) {
        if (!active) {
          return
        }

        const changed = !hasSameValue(target.value, value)
        target.value = value
        if (!changed) {
          return
        }

        refreshing = true
        try {
          instance.refresh()
        } finally {
          refreshing = false
        }
      }

      function onChange({ value }: { value: T }) {
        if (!active || refreshing) {
          return
        }

        const current = model.value
        if (hasSameValue(value, current)) {
          return
        }

        try {
          model.value = copyValue(value, current)
        } finally {
          // Wait for the native change to finish before correcting a writable computed.
          if (active && !hasSameValue(target.value, model.value)) {
            void nextTick(() => {
              if (active) {
                syncFromModel(copyValue(model.value))
              }
            })
          }
        }
      }

      instance.on('change', onChange)

      try {
        modelScope.run(() =>
          watch(() => copyValue(model.value), syncFromModel, {
            immediate: true,
          }),
        )
      } catch (error) {
        dispose()
        throw error
      }

      if (active) {
        binding.value = instance
      }
    },
    { flush: 'post', immediate: true },
  )

  return shallowReadonly(binding)
}
