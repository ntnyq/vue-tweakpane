import { isUndefined } from '@ntnyq/utils'
import { Pane } from 'tweakpane'
import {
  getCurrentInstance,
  getCurrentScope,
  onMounted,
  shallowReadonly,
  shallowRef,
  toValue,
  watch,
} from 'vue'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { Disposable, TweakpaneOptions } from '../types'
import { managePaneBindings } from '../utils'

/**
 * Creates a native Tweakpane pane in the current host element.
 *
 * In component setup, pane creation waits until the component mounts. The
 * current pane is disposed when the host changes or the Vue scope stops.
 * Calling its native `dispose()` method also clears the pane and its bindings.
 *
 * @param host The container element, a ref, or a getter. An absent element
 * prevents pane creation.
 * @param options Optional title, initial expanded state, and configuration
 * callback. Cleanup returned by `configure` runs as part of pane disposal.
 * @returns A shallow, read-only ref containing the current pane, or `null`
 * when no pane is available.
 *
 * @example
 * ```ts
 * const hostRef = useTemplateRef<HTMLElement>('hostRef')
 * const pane = useTweakpane(hostRef, { title: 'Scene' })
 * ```
 */
export function useTweakpane(
  host: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options?: TweakpaneOptions,
): Readonly<ShallowRef<Pane | null>> {
  const pane = shallowRef<Pane | null>(null)

  function watchHost() {
    watch(
      () => toValue(host),
      (container, _previous, onCleanup) => {
        if (!container) {
          return
        }

        const { configure, ...config } = options ?? {}
        const instance = new Pane({
          ...config,
          container,
          document: container.ownerDocument,
        })
        const disposePane = instance.dispose.bind(instance)
        const disposeBindings = managePaneBindings(instance.element)
        let cleanup: void | Disposable
        let disposed = false

        function dispose() {
          if (disposed) {
            return
          }

          disposed = true
          try {
            try {
              disposeBindings()
            } finally {
              pane.value = null
            }
          } finally {
            try {
              cleanup?.()
            } finally {
              disposePane()
            }
          }
        }

        instance.dispose = dispose
        onCleanup(dispose)

        try {
          const configureCleanup = configure?.(instance)
          if (disposed) {
            configureCleanup?.()
            return
          }
          cleanup = configureCleanup
        } catch (error) {
          dispose()
          throw error
        }

        pane.value = instance
      },
      { flush: 'post', immediate: true },
    )
  }

  if (getCurrentInstance()) {
    const scope = getCurrentScope()

    onMounted(() => {
      if (scope?.active) {
        scope.run(watchHost)
      }
    })
  } else if (!isUndefined(globalThis.document)) {
    watchHost()
  }

  return shallowReadonly(pane)
}
