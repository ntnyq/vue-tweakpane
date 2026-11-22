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

/**
 * A native pane or folder that hosts controls rendered by Vue.
 */
export type Rack = Pane | FolderApi

/**
 * Creates the native control for a registered entry.
 *
 * @param rack The native container that receives the control.
 * @param index The insertion index among the rack's native children.
 * @param updateErrors The shared error list for a parent rack update, if any.
 * @returns The mounted control and its cleanup callback.
 */
type MountEntry = (
  rack: Rack,
  index: number,
  updateErrors?: unknown[],
) => MountedControl

/**
 * A Vue control registered with its nearest rack provider.
 */
interface RackEntry {
  /**
   * The slot element used to determine rack membership and control order.
   */
  anchor: HTMLElement
  /**
   * Creates the native control when the rack synchronizes its entries.
   */
  mount: MountEntry
}

/**
 * The resources created by a single control mount.
 */
interface MountedControl {
  /**
   * The native blade used to locate neighboring controls, or null if none
   * is available.
   */
  blade: BladeApi | null
  /**
   * Releases the native control and any resources created during its mount.
   */
  dispose: Disposable
}

/**
 * A mounted control paired with the Vue entry that created it.
 */
interface MountedEntry extends MountedControl {
  /**
   * The registration used to match this control across rack updates.
   */
  entry: RackEntry
}

/**
 * The tail of a candidate increasing subsequence of previous mount indices.
 */
interface CandidateSubsequenceTail {
  /**
   * The registered Vue control at the end of the candidate subsequence.
   */
  entry: RackEntry
  /**
   * The entry's index before reconciliation, used to compare candidates.
   */
  index: number
}

/**
 * Operations owned by a single rack mount.
 */
interface RackMount {
  /**
   * Synchronizes native controls with the current slot contents and reports
   * update failures through Vue.
   */
  syncControls: () => void
  /**
   * Removes and disposes the native control for an unregistering Vue entry.
   *
   * @param entry The registration that was removed from the rack.
   */
  remove: (entry: RackEntry) => void
}

/**
 * Registers a Vue control with its nearest rack provider.
 *
 * @param anchor The mounted slot element that determines the control's position.
 * @param mount The callback that creates the native control.
 * @returns A callback that unregisters the entry and disposes its mounted control.
 */
type RegisterEntry = (anchor: HTMLElement, mount: MountEntry) => Disposable

/**
 * Injection key for the nearest rack's registration callback.
 */
const RACK_KEY: InjectionKey<RegisterEntry> = Symbol('Tweakpane rack')

/**
 * Provides a rack context for controls rendered in a Vue slot.
 *
 * Call during component setup. The returned function attaches an existing
 * native pane or folder once the slot container is mounted and keeps its
 * controls in DOM order. Native rack disposal also tears down the mount.
 *
 * @param anchor A template ref to the container that holds the slot controls.
 * @returns A function that mounts the registered controls, optionally collects
 * mount errors in the parent update's error list, and returns a callback that
 * stops synchronization and disposes the mounted controls.
 */
export function provideRack(anchor: Readonly<Ref<HTMLElement | null>>) {
  const component = getCurrentInstance()
  const entries = new Set<RackEntry>()
  const revision = shallowRef(0)

  /**
   * The current rack mount, cleared when that mount begins disposal.
   */
  let activeRackMount: RackMount | undefined

  provide(RACK_KEY, (element, mount) => {
    const entry = {
      /**
       * The DOM anchor supplied by the registering Vue component.
       */
      anchor: element,
      /**
       * The factory to call each time this entry needs a native control.
       */
      mount,
    }
    entries.add(entry)
    revision.value++

    return () => {
      entries.delete(entry)
      try {
        activeRackMount?.remove(entry)
      } catch (error) {
        reportVueError(error, component, ErrorCodes.COMPONENT_UPDATE)
      }
    }
  })

  watch(
    revision,
    () => {
      activeRackMount?.syncControls()
    },
    { flush: 'post' },
  )

  /**
   * Mounts slot controls into a native rack and keeps them in DOM order.
   *
   * @param rack The native pane or folder that receives the controls.
   * @param parentUpdateErrors An optional error list shared with a parent rack
   * update. Initial reconciliation appends control errors to this list so the
   * parent can report them after its update finishes.
   * @returns A cleanup callback that stops synchronization, disconnects the
   * slot observer, removes the native disposal listener, and disposes the
   * mounted controls. It throws collected disposal errors after attempting
   * to dispose every control.
   * @throws If the slot container is missing, native setup fails, or initial
   * reconciliation fails without a shared error list.
   */
  return function mountRack(
    rack: Rack,
    parentUpdateErrors?: unknown[],
  ): Disposable {
    if (!anchor.value) {
      throw new Error('Expected a mounted Tweakpane slot container')
    }

    const root = anchor.value
    const nativeRack = rack.controller.rackController.rack
    const rackDisposedState = rack.controller.viewProps.value('disposed')
    const mountedEntries: MountedEntry[] = []
    const Observer =
      root.ownerDocument.defaultView?.MutationObserver ?? MutationObserver
    const observer = new Observer(() => revision.value++)

    // A factory can dispose the native rack before Vue receives its cleanup.
    function isRackMountActive() {
      return activeRackMount === rackMount && !rackDisposedState.rawValue
    }

    function disposeAt(index: number) {
      const [removed] = mountedEntries.splice(index, 1)
      removed?.dispose()
    }

    /**
     * Converts a Vue-managed entry position to a native rack insertion index.
     *
     * The native child list can include imperatively added controls, and a
     * factory can remove an earlier blade during the same update. Searches
     * backward for the closest preceding Vue-managed blade still in the rack.
     *
     * @param mountedIndex The insertion position in the Vue-managed
     * `mountedEntries` list.
     * @returns The native child index immediately after that blade, or 0
     * to insert at the front of the rack when there is no preceding blade
     * to anchor the insertion.
     */
    function getInsertionIndex(mountedIndex: number) {
      if (mountedIndex === 0) {
        return 0
      }

      const children = nativeRack.children
      for (let previous = mountedIndex - 1; previous >= 0; previous--) {
        const blade = mountedEntries[previous]?.blade
        if (blade) {
          const index = children.lastIndexOf(toRaw(blade).controller)
          if (index !== -1) {
            return index + 1
          }
        }
      }
      return 0
    }

    /**
     * Synchronizes the native controls with the current slot contents.
     *
     * Orders entries by their anchors in the slot DOM. Keeps controls whose
     * previous indices form a longest increasing subsequence in that order,
     * disposes the other mounted controls, and mounts missing entries in DOM
     * order. Tears down the mount if the rack is no longer active.
     *
     * @param updateErrors An optional error list shared with the outer rack
     * update. Control errors are appended so remaining entries can be processed
     * and the caller can report the failures after the update.
     * @throws If disposal of an already inactive mount fails, or if
     * reconciliation collects errors without a shared error list.
     */
    function reconcileControls(updateErrors?: unknown[]) {
      if (!isRackMountActive()) {
        dispose()
        return
      }

      const orderedEntries = [...entries].filter(entry =>
        root.contains(entry.anchor),
      )
      orderedEntries.sort((first, second) =>
        first.anchor.compareDocumentPosition(second.anchor) &
        first.anchor.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      )

      const previousIndexByEntry = new Map(
        mountedEntries.map(({ entry }, index) => [entry, index]),
      )
      const retainedEntries = new Set<RackEntry>()
      const candidateSubsequenceTails: CandidateSubsequenceTail[] = []
      const predecessorByEntry = new Map<RackEntry, RackEntry | undefined>()

      // Moving native blades through remove()/add() can duplicate Tweakpane
      // listeners.
      for (const entry of orderedEntries) {
        const index = previousIndexByEntry.get(entry)
        if (index === undefined) {
          continue
        }

        let low = 0
        let high = candidateSubsequenceTails.length
        while (low < high) {
          const middle = Math.floor((low + high) / 2)
          if (candidateSubsequenceTails[middle]!.index < index) {
            low = middle + 1
          } else {
            high = middle
          }
        }
        predecessorByEntry.set(entry, candidateSubsequenceTails[low - 1]?.entry)
        candidateSubsequenceTails[low] = { entry, index }
      }

      let retainedEntry = candidateSubsequenceTails.at(-1)?.entry
      while (retainedEntry) {
        retainedEntries.add(retainedEntry)
        retainedEntry = predecessorByEntry.get(retainedEntry)
      }

      const errors = updateErrors ?? []
      for (
        let index = mountedEntries.length - 1;
        index >= 0 && isRackMountActive();
        index--
      ) {
        const current = mountedEntries[index]
        if (current && !retainedEntries.has(current.entry)) {
          try {
            disposeAt(index)
          } catch (error) {
            errors.push(error)
          }
        }
      }

      let mountedIndex = 0
      for (const entry of orderedEntries) {
        if (!isRackMountActive()) {
          break
        }
        if (retainedEntries.has(entry)) {
          mountedIndex++
          continue
        }
        try {
          const index = getInsertionIndex(mountedIndex)
          const control = entry.mount(rack, index, updateErrors)
          if (!isRackMountActive()) {
            control.dispose()
            break
          }
          mountedEntries.splice(mountedIndex, 0, { ...control, entry })
          mountedIndex++
        } catch (error) {
          errors.push(error)
          if (!updateErrors) {
            break
          }
        }
      }

      if (!isRackMountActive()) {
        disposeMounted(errors)
      }
      if (!updateErrors) {
        throwCollectedErrors(errors, 'Failed to sync Tweakpane controls')
      }
    }

    function disposeMounted(errors: unknown[]) {
      if (activeRackMount === rackMount) {
        activeRackMount = undefined
      }
      observer.disconnect()
      rackDisposedState.emitter.off('change', onNativeDispose)

      while (mountedEntries.length) {
        try {
          disposeAt(mountedEntries.length - 1)
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
      if (!rackDisposedState.rawValue) {
        return
      }
      try {
        dispose()
      } catch (error) {
        reportVueError(error, component, ErrorCodes.NATIVE_EVENT_HANDLER)
      }
    }

    const rackMount: RackMount = {
      syncControls() {
        const errors: unknown[] = []
        try {
          reconcileControls(errors)
          throwCollectedErrors(errors, 'Failed to sync Tweakpane controls')
        } catch (error) {
          reportVueError(error, component, ErrorCodes.COMPONENT_UPDATE)
        }
      },
      remove(entry) {
        const index = mountedEntries.findIndex(
          current => current.entry === entry,
        )
        if (index !== -1) {
          disposeAt(index)
        }
      },
    }
    activeRackMount = rackMount
    try {
      rackDisposedState.emitter.on('change', onNativeDispose)
      observer.observe(root, { childList: true, subtree: true })
      reconcileControls(parentUpdateErrors)
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

/**
 * Registers a Vue control with its nearest rack provider.
 *
 * Call during component setup. The entry registers on mount when its anchor
 * is available and is unregistered before the component unmounts.
 *
 * @param anchor A template ref to the element that determines the control's
 * position in the rack.
 * @param mount The factory called each time the entry needs a native control.
 * @throws If no ancestor rack provider is available.
 */
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
