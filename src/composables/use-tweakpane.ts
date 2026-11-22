import { isUndefined } from '@ntnyq/utils'
import { Pane } from 'tweakpane'
import {
  ErrorCodes,
  getCurrentInstance,
  getCurrentScope,
  onMounted,
  onScopeDispose,
  shallowReadonly,
  shallowRef,
  toValue,
  watch,
} from 'vue'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { Disposable, TweakpaneOptions } from '../types'
import { managePaneBindings } from '../utils'
import {
  reportVueError,
  rethrowAfterCleanup,
  throwCollectedErrors,
} from '../utils/vue-error'

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
 * During host changes and scope teardown, Vue reports cleanup errors after
 * attempting the remaining lifecycle work.
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
  const component = getCurrentInstance()
  const scope = getCurrentScope()
  let disposeCurrent: Disposable | undefined

  function clearPane() {
    pane.value = null
  }

  if (scope) {
    onScopeDispose(() => {
      try {
        disposeCurrent?.()
      } catch (error) {
        reportVueError(error, component, ErrorCodes.APP_UNMOUNT_CLEANUP)
      }
    })
  }

  function mountPane(container: HTMLElement) {
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
      disposeCurrent = undefined
      const errors: unknown[] = []
      for (const release of [
        disposeBindings,
        clearPane,
        cleanup,
        disposePane,
      ]) {
        try {
          release?.()
        } catch (error) {
          errors.push(error)
        }
      }
      throwCollectedErrors(errors, 'Failed to dispose Tweakpane')
    }

    instance.dispose = dispose
    disposeCurrent = dispose

    try {
      const configureCleanup = configure?.(instance)
      if (disposed) {
        configureCleanup?.()
        return
      }
      cleanup = configureCleanup
    } catch (error) {
      rethrowAfterCleanup(
        error,
        dispose,
        'Failed to configure and dispose Tweakpane',
      )
    }
    pane.value = instance
  }

  function watchHost() {
    let initialErrors: unknown[] | undefined = component ? undefined : []
    const stop = watch(
      () => toValue(host),
      container => {
        const errors = initialErrors ?? []
        try {
          disposeCurrent?.()
        } catch (error) {
          errors.push(error)
        }

        try {
          if (container && (!scope || scope.active)) {
            mountPane(container)
          }
        } catch (error) {
          errors.push(error)
        }

        if (!initialErrors) {
          try {
            throwCollectedErrors(errors, 'Failed to replace Tweakpane')
          } catch (error) {
            reportVueError(error, component, ErrorCodes.COMPONENT_UPDATE)
          }
        }
      },
      { flush: 'post', immediate: true },
    )
    const errors = initialErrors
    initialErrors = undefined
    if (errors?.length) {
      stop()
      throwCollectedErrors(errors, 'Failed to create Tweakpane')
    }
  }

  if (component) {
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
