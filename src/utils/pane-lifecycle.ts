import type { Disposable } from '../types'

/**
 * Bindings initially attached to each managed pane, including detached
 * bindings.
 */
const paneBindings = new WeakMap<Element, Set<Element>>()

/**
 * Cleanup callbacks indexed by binding element so they follow native moves.
 */
const bindingDisposers = new WeakMap<Element, Disposable>()

/**
 * Finds the bindings registered to the closest managed pane.
 *
 * @param element The element whose ancestors are searched.
 * @returns The pane's binding set when the element has a managed ancestor.
 */
function findPaneBindings(element: Element): Set<Element> | undefined {
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const bindings = paneBindings.get(parent)
    if (bindings) {
      return bindings
    }
  }
  return undefined
}

/**
 * Tracks bindings for the lifetime of a pane.
 *
 * @param element The pane's root element.
 * @returns A callback that disposes all registered bindings.
 */
export function managePaneBindings(element: HTMLElement): Disposable {
  const bindings = new Set<Element>()
  paneBindings.set(element, bindings)

  return () => {
    // Native add() can move a binding or its entire folder to another pane.
    for (const descendant of element.querySelectorAll('*')) {
      if (bindingDisposers.has(descendant)) {
        bindings.add(descendant)
      }
    }

    const errors: unknown[] = []
    try {
      for (const binding of bindings) {
        if (findPaneBindings(binding) === bindings || !binding.parentElement) {
          try {
            bindingDisposers.get(binding)?.()
          } catch (error) {
            errors.push(error)
          }
        }
      }
    } finally {
      paneBindings.delete(element)
      bindings.clear()
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, 'Failed to dispose pane bindings')
    }
    if (errors.length === 1) {
      throw errors[0]
    }
  }
}

/**
 * Registers a binding so its current managed pane can dispose it.
 *
 * @param element The binding's root element.
 * @param dispose The binding cleanup callback.
 * @returns A callback that removes the registration if one was made.
 */
export function registerPaneBinding(
  element: HTMLElement,
  dispose: Disposable,
): Disposable {
  const bindings = findPaneBindings(element)
  bindings?.add(element)
  bindingDisposers.set(element, dispose)

  return () => {
    bindings?.delete(element)
    bindingDisposers.delete(element)
  }
}
