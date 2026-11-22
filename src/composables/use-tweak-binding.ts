import { BladeApi } from 'tweakpane'
import type { BindingParams, Pane } from 'tweakpane'
import {
  ErrorCodes,
  effectScope,
  getCurrentInstance,
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
import { createBindingValueAdapter, registerPaneBinding } from '../utils'
import { reportVueError, rethrowAfterCleanup } from '../utils/vue-error'

/**
 * Synchronizes a writable Vue model with a native Tweakpane input binding.
 *
 * Edits update the model, and model changes refresh the input. The current
 * binding is disposed when the parent changes or the Vue scope stops.
 * Native disposal of the binding or its containing pane, folder, or tab also
 * stops synchronization.
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
  const component = getCurrentInstance()
  const scope = getCurrentScope()

  function mountBinding(
    rack: Pick<Pane, 'addBinding'>,
    onCleanup: (dispose: Disposable) => void,
  ) {
    const rackDisposedState =
      rack instanceof BladeApi
        ? rack.controller.viewProps.value('disposed')
        : undefined
    if (rackDisposedState?.rawValue) {
      return
    }

    // Cleanup can invalidate this mount before addBinding returns.
    let isBindingMountActive = true
    let cleanup: Disposable | undefined

    function dispose() {
      if (!isBindingMountActive) {
        return
      }

      isBindingMountActive = false
      const disposeResources = cleanup
      cleanup = undefined
      disposeResources?.()
    }

    onCleanup(() => {
      try {
        dispose()
      } catch (error) {
        reportVueError(error, component, ErrorCodes.COMPONENT_UPDATE)
      }
    })

    const {
      target,
      createModelSnapshot,
      createUpdatedModelValue,
      areControlValuesEqual,
    } = createBindingValueAdapter(model.value)
    if (!isBindingMountActive || rackDisposedState?.rawValue) {
      return
    }

    const instance = rack.addBinding(target, 'value', params)
    const bindingDisposedState = instance.controller.viewProps.value('disposed')
    if (
      !isBindingMountActive ||
      bindingDisposedState.rawValue ||
      rackDisposedState?.rawValue
    ) {
      if (!bindingDisposedState.rawValue) {
        instance.dispose()
      }
      return
    }

    const disposeNativeBinding = instance.dispose.bind(instance)
    const modelScope = scope?.run(effectScope) ?? effectScope(true)
    const unregister = registerPaneBinding(instance.element, dispose)

    cleanup = () => {
      bindingDisposedState.emitter.off('change', onNativeDispose)
      unregister()
      modelScope.stop()
      instance.off('change', onChange)
      try {
        // A native rack is already iterating its children during disposal.
        if (
          !bindingDisposedState.rawValue &&
          !instance.controller.parent?.viewProps.get('disposed')
        ) {
          disposeNativeBinding()
        }
      } finally {
        binding.value = null
      }
    }
    instance.dispose = dispose
    bindingDisposedState.emitter.on('change', onNativeDispose)

    function onNativeDispose() {
      if (!bindingDisposedState.rawValue) {
        return
      }

      try {
        dispose()
      } catch (error) {
        reportVueError(error, component, ErrorCodes.NATIVE_EVENT_HANDLER)
      }
    }

    // Ignore native change events emitted synchronously by a model-driven refresh.
    let isRefreshingBindingFromModel = false

    function syncFromModel(value: T) {
      if (!isBindingMountActive) {
        return
      }

      const changed = !areControlValuesEqual(target.value, value)
      target.value = value
      if (!changed) {
        return
      }

      isRefreshingBindingFromModel = true
      try {
        instance.refresh()
      } finally {
        isRefreshingBindingFromModel = false
      }
    }

    function onChange({ value }: { value: T }) {
      if (!isBindingMountActive || isRefreshingBindingFromModel) {
        return
      }

      const current = model.value
      if (areControlValuesEqual(value, current)) {
        return
      }

      try {
        model.value = createUpdatedModelValue(value, current)
      } finally {
        // Wait for the native change to finish before correcting a writable computed.
        if (
          isBindingMountActive &&
          !areControlValuesEqual(target.value, model.value)
        ) {
          void nextTick(() => {
            if (isBindingMountActive) {
              syncFromModel(createModelSnapshot(model.value))
            }
          })
        }
      }
    }

    instance.on('change', onChange)

    try {
      modelScope.run(() =>
        watch(() => createModelSnapshot(model.value), syncFromModel, {
          immediate: true,
        }),
      )
    } catch (error) {
      rethrowAfterCleanup(
        error,
        dispose,
        'Failed to initialize and dispose Tweakpane binding',
      )
    }

    if (isBindingMountActive) {
      binding.value = instance
    }
  }

  let initialErrors: unknown[] | undefined = []
  const stop = watch(
    () => toRaw(toValue(parent)),
    (rack, _previous, onCleanup) => {
      if (!rack) {
        return
      }
      try {
        mountBinding(rack, onCleanup)
      } catch (error) {
        if (initialErrors) {
          initialErrors.push(error)
        } else {
          reportVueError(error, component, ErrorCodes.COMPONENT_UPDATE)
        }
      }
    },
    { flush: 'post', immediate: true },
  )
  const errors = initialErrors
  initialErrors = undefined
  if (errors.length) {
    stop()
    throw errors[0]
  }

  return shallowReadonly(binding)
}
