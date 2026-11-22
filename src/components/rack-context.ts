import type { BladeApi, FolderApi, Pane } from 'tweakpane'
import {
  ErrorCodes,
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  toRaw,
  watch,
} from 'vue'
import type { InjectionKey, Ref } from 'vue'
import type { Disposable } from '../types'
import { reportVueError, throwCollectedErrors } from '../utils/vue-error'

export type Rack = Pane | FolderApi

type MountEntry = (
  rack: Rack,
  index: number,
  updateErrors?: unknown[],
) => MountedControl

interface RackEntry {
  anchor: HTMLElement
  mount: MountEntry
}

interface MountedControl {
  blade: BladeApi | null
  dispose: Disposable
}

interface MountedEntry extends MountedControl {
  entry: RackEntry
}

type RegisterEntry = (anchor: HTMLElement, mount: MountEntry) => Disposable

const RACK_KEY: InjectionKey<RegisterEntry> = Symbol('Tweakpane rack')

export function provideRack(anchor: Readonly<Ref<HTMLElement | null>>) {
  const component = getCurrentInstance()
  const entries = new Set<RackEntry>()
  const revision = shallowRef(0)
  let active:
    | { sync: () => void; remove: (entry: RackEntry) => void }
    | undefined

  provide(RACK_KEY, (element, mount) => {
    const entry = { anchor: element, mount }
    entries.add(entry)
    revision.value++

    return () => {
      entries.delete(entry)
      try {
        active?.remove(entry)
      } catch (error) {
        reportVueError(error, component, ErrorCodes.COMPONENT_UPDATE)
      }
    }
  })

  watch(revision, () => active?.sync(), { flush: 'post' })

  return function mountRack(
    rack: Rack,
    parentUpdateErrors?: unknown[],
  ): Disposable {
    if (!anchor.value) {
      throw new Error('Expected a mounted Tweakpane slot container')
    }

    const root = anchor.value
    const nativeRack = rack.controller.rackController.rack
    const rackDisposed = rack.controller.viewProps.value('disposed')
    const mounted: MountedEntry[] = []
    const Observer =
      root.ownerDocument.defaultView?.MutationObserver ?? MutationObserver
    const observer = new Observer(() => revision.value++)

    function isMounted() {
      // A factory can dispose the native rack before Vue receives its cleanup.
      return active === mountedRack && !rackDisposed.rawValue
    }

    function disposeAt(index: number) {
      const [removed] = mounted.splice(index, 1)
      removed?.dispose()
    }

    function getInsertionIndex(mountedIndex: number) {
      if (mountedIndex === 0) {
        return 0
      }

      // A factory can remove earlier controls during this same update.
      const children = nativeRack.children
      for (let previous = mountedIndex - 1; previous >= 0; previous--) {
        const blade = mounted[previous]?.blade
        if (blade) {
          const index = children.lastIndexOf(toRaw(blade).controller)
          if (index !== -1) {
            return index + 1
          }
        }
      }
      return 0
    }

    function sync(updateErrors?: unknown[]) {
      if (!isMounted()) {
        dispose()
        return
      }

      const ordered = [...entries].filter(entry => root.contains(entry.anchor))
      ordered.sort((first, second) =>
        first.anchor.compareDocumentPosition(second.anchor) &
        first.anchor.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      )

      const previousIndices = new Map(
        mounted.map(({ entry }, index) => [entry, index]),
      )
      const retained = new Set<RackEntry>()
      const tails: { entry: RackEntry; index: number }[] = []
      const predecessors = new Map<RackEntry, RackEntry | undefined>()

      // Retain a longest increasing subsequence of the old indices, minimizing
      // rebuilds. Moving native blades through remove()/add() can duplicate
      // Tweakpane listeners, so only entries outside this sequence are remounted.
      for (const entry of ordered) {
        const index = previousIndices.get(entry)
        if (index === undefined) {
          continue
        }

        let low = 0
        let high = tails.length
        while (low < high) {
          const middle = Math.floor((low + high) / 2)
          if (tails[middle]!.index < index) {
            low = middle + 1
          } else {
            high = middle
          }
        }
        predecessors.set(entry, tails[low - 1]?.entry)
        tails[low] = { entry, index }
      }

      let retainedEntry = tails.at(-1)?.entry
      while (retainedEntry) {
        retained.add(retainedEntry)
        retainedEntry = predecessors.get(retainedEntry)
      }

      // Nested racks share the outer update's errors so Vue sees them after mounting.
      const errors = updateErrors ?? []
      for (let index = mounted.length - 1; index >= 0 && isMounted(); index--) {
        const current = mounted[index]
        if (current && !retained.has(current.entry)) {
          try {
            disposeAt(index)
          } catch (error) {
            errors.push(error)
          }
        }
      }

      let mountedIndex = 0
      for (const entry of ordered) {
        if (!isMounted()) {
          break
        }
        if (retained.has(entry)) {
          mountedIndex++
          continue
        }
        try {
          const index = getInsertionIndex(mountedIndex)
          const control = entry.mount(rack, index, updateErrors)
          if (!isMounted()) {
            control.dispose()
            break
          }
          mounted.splice(mountedIndex, 0, { ...control, entry })
          mountedIndex++
        } catch (error) {
          errors.push(error)
          if (!updateErrors) {
            break
          }
        }
      }

      if (!isMounted()) {
        disposeMounted(errors)
      }
      if (!updateErrors) {
        throwCollectedErrors(errors, 'Failed to sync Tweakpane controls')
      }
    }

    function disposeMounted(errors: unknown[]) {
      if (active === mountedRack) {
        active = undefined
      }
      observer.disconnect()
      rackDisposed.emitter.off('change', onNativeDispose)

      while (mounted.length) {
        try {
          disposeAt(mounted.length - 1)
        } catch (error) {
          errors.push(error)
        }
      }
    }

    function dispose() {
      const errors: unknown[] = []
      disposeMounted(errors)
      throwCollectedErrors(errors, 'Failed to dispose Tweakpane controls')
    }

    function onNativeDispose() {
      if (!rackDisposed.rawValue) {
        return
      }
      try {
        dispose()
      } catch (error) {
        reportVueError(error, component, ErrorCodes.NATIVE_EVENT_HANDLER)
      }
    }

    const mountedRack = {
      sync() {
        const errors: unknown[] = []
        try {
          sync(errors)
          throwCollectedErrors(errors, 'Failed to sync Tweakpane controls')
        } catch (error) {
          reportVueError(error, component, ErrorCodes.COMPONENT_UPDATE)
        }
      },
      remove(entry: RackEntry) {
        const index = mounted.findIndex(current => current.entry === entry)
        if (index !== -1) {
          disposeAt(index)
        }
      },
    }
    active = mountedRack
    try {
      rackDisposed.emitter.on('change', onNativeDispose)
      observer.observe(root, { childList: true, subtree: true })
      sync(parentUpdateErrors)
    } catch (error) {
      const errors = [error]
      disposeMounted(errors)
      throwCollectedErrors(
        errors,
        'Failed to mount and dispose Tweakpane controls',
      )
    }
    return dispose
  }
}

export function useRackEntry(
  anchor: Readonly<Ref<HTMLElement | null>>,
  mount: MountEntry,
) {
  const register = inject(RACK_KEY, null)

  if (!register) {
    throw new Error(
      'Tweakpane controls must be rendered inside <TweakPane> or <TweakFolder>',
    )
  }

  let unregister: Disposable | undefined

  onMounted(() => {
    if (anchor.value) {
      unregister = register(anchor.value, mount)
    }
  })
  onBeforeUnmount(() => {
    unregister?.()
  })
}
