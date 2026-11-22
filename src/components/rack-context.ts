import type { FolderApi, Pane } from 'tweakpane'
import {
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  watch,
} from 'vue'
import type { InjectionKey, Ref } from 'vue'
import type { Disposable } from '../types'

export type Rack = Pane | FolderApi

type MountEntry = (rack: Rack, index: number) => Disposable

interface RackEntry {
  anchor: HTMLElement
  mount: MountEntry
}

interface MountedEntry {
  entry: RackEntry
  dispose: Disposable
}

type RegisterEntry = (anchor: HTMLElement, mount: MountEntry) => Disposable

const RACK_KEY: InjectionKey<RegisterEntry> = Symbol('Tweakpane rack')

export function provideRack(anchor: Readonly<Ref<HTMLElement | null>>) {
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
      active?.remove(entry)
    }
  })

  watch(revision, () => active?.sync(), { flush: 'post' })

  return function mountRack(rack: Rack): Disposable {
    if (!anchor.value) {
      throw new Error('Expected a mounted Tweakpane slot container')
    }

    const root = anchor.value
    const mounted: MountedEntry[] = []
    const Observer =
      root.ownerDocument.defaultView?.MutationObserver ?? MutationObserver
    const observer = new Observer(() => revision.value++)

    function disposeAt(index: number) {
      const [removed] = mounted.splice(index, 1)
      removed?.dispose()
    }

    function sync() {
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

      for (let index = mounted.length - 1; index >= 0; index--) {
        const current = mounted[index]
        if (current && !retained.has(current.entry)) {
          disposeAt(index)
        }
      }

      for (const [index, entry] of ordered.entries()) {
        if (!retained.has(entry)) {
          const disposeEntry = entry.mount(rack, index)
          mounted.splice(index, 0, { entry, dispose: disposeEntry })
        }
      }
    }

    function dispose() {
      active = undefined
      observer.disconnect()

      const errors: unknown[] = []
      while (mounted.length) {
        try {
          disposeAt(mounted.length - 1)
        } catch (error) {
          errors.push(error)
        }
      }
      if (errors.length === 1) {
        throw errors[0]
      }
      if (errors.length > 1) {
        throw new AggregateError(errors, 'Failed to dispose Tweakpane controls')
      }
    }

    active = {
      sync,
      remove(entry) {
        const index = mounted.findIndex(current => current.entry === entry)
        if (index !== -1) {
          disposeAt(index)
        }
      },
    }
    observer.observe(root, { childList: true, subtree: true })
    try {
      sync()
    } catch (error) {
      dispose()
      throw error
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
  onBeforeUnmount(() => unregister?.())
}
