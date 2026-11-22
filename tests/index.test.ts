// @vitest-environment happy-dom

import { runInNewContext } from 'node:vm'
import { Pane } from 'tweakpane'
import { expect, it, vi } from 'vitest'
import {
  computed,
  createApp,
  effectScope,
  h,
  nextTick,
  onScopeDispose,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { useTweakBinding, useTweakpane } from '../src'
import type { TweakPoint } from '../src'

function getInput(element: HTMLElement): HTMLInputElement {
  const input = element.querySelector('input')
  if (!input) {
    throw new Error('Expected a Tweakpane input')
  }
  return input
}

function editInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('change'))
}

it('creates panes after mount and cleans up nested bindings before replacing or disposing a pane', async () => {
  const mountPoint = document.createElement('div')
  const showAlternate = shallowRef(false)
  const cleanup = vi.fn<() => void>()
  const app = createApp({
    setup() {
      const hostRef = useTemplateRef<HTMLElement>('hostRef')
      const folder = shallowRef<ReturnType<Pane['addFolder']> | null>(null)
      const pane = useTweakpane(hostRef, {
        configure(instance) {
          const motion = instance.addFolder({ title: 'Motion' })
          folder.value = motion
          return () => {
            expect(motion.children).toHaveLength(0)
            expect(instance.element.parentElement).not.toBeNull()
            cleanup()
            folder.value = null
          }
        },
      })
      useTweakBinding(folder, shallowRef(1))
      expect(pane.value).toBeNull()
      return () =>
        h('div', { key: Number(showAlternate.value), ref: 'hostRef' })
    },
  })

  app.mount(mountPoint)
  try {
    await nextTick()
    const originalHost = mountPoint.firstElementChild
    expect(originalHost?.querySelectorAll('input')).toHaveLength(1)

    showAlternate.value = true
    await nextTick()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(originalHost?.childElementCount).toBe(0)
    expect(mountPoint.querySelectorAll('input')).toHaveLength(1)
  } finally {
    app.unmount()
  }
  expect(cleanup).toHaveBeenCalledTimes(2)
})

it('disposes bindings with the pane that receives their folder', async () => {
  const originalScope = effectScope()
  const receivingScope = effectScope()
  const bindingScope = effectScope()
  const originalHost = document.createElement('div')
  const receivingHost = document.createElement('div')
  const model = ref(1)

  try {
    const original = originalScope.run(() => useTweakpane(originalHost))
    const receiving = receivingScope.run(() => useTweakpane(receivingHost))
    const folder = original?.value?.addFolder({ title: 'Movable' })
    const binding = bindingScope.run(() => useTweakBinding(folder, model))

    if (!folder) {
      throw new Error('Expected a Tweakpane folder')
    }
    receiving?.value?.add(folder)
    const input = getInput(receivingHost)

    originalScope.stop()
    model.value = 2
    await nextTick()
    expect(getInput(receivingHost)).toBe(input)
    expect(Number(input.value)).toBe(2)
    editInput(input, '3')
    expect(model.value).toBe(3)

    receivingScope.stop()
    expect(binding?.value).toBeNull()
    expect(receivingHost.querySelector('input')).toBeNull()
  } finally {
    bindingScope.stop()
    originalScope.stop()
    receivingScope.stop()
  }
})

it('stops syncing when a native folder parent is cleared before disposal', async () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const model = shallowRef(1)

  try {
    const pane = scope.run(() => useTweakpane(host))?.value
    if (!pane) {
      throw new Error('Expected a Tweakpane pane')
    }
    const folder = pane.addFolder({ title: 'Motion' })
    const parent = shallowRef<typeof folder | null>(folder)
    const binding = scope.run(() => useTweakBinding(parent, model))
    const input = getInput(folder.element)
    editInput(input, '2')
    expect(model.value).toBe(2)

    parent.value = null
    await nextTick()
    expect(binding?.value).toBeNull()
    expect(folder.children).toHaveLength(0)

    folder.dispose()
    expect(pane.children).toHaveLength(0)
    expect(host.contains(pane.element)).toBe(true)

    model.value = 3
    await nextTick()
    expect(Number(input.value)).toBe(2)
    editInput(input, '4')
    expect(model.value).toBe(3)
  } finally {
    scope.stop()
  }
})

it('automatically unbinds a directly disposed native folder and its descendants', async () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const folder = pane.addFolder({ title: 'Motion' })
  const parent = shallowRef(folder)
  const model = shallowRef(1)
  const nestedModel = shallowRef(2)
  const siblingModel = shallowRef(3)

  try {
    const binding = scope.run(() => useTweakBinding(parent, model))
    const input = getInput(folder.element)
    const nested = folder.addFolder({ title: 'Position' })
    const nestedBinding = scope.run(() => useTweakBinding(nested, nestedModel))
    const siblingBinding = scope.run(() => useTweakBinding(pane, siblingModel))
    const nestedInput = getInput(nested.element)

    folder.dispose()
    expect(binding?.value).toBeNull()
    expect(nestedBinding?.value).toBeNull()
    expect(siblingBinding?.value).not.toBeNull()
    expect(host.contains(folder.element)).toBe(false)

    model.value = 4
    nestedModel.value = 5
    await nextTick()
    expect(Number(input.value)).toBe(1)
    expect(Number(nestedInput.value)).toBe(2)
    editInput(input, '6')
    editInput(nestedInput, '7')
    expect(model.value).toBe(4)
    expect(nestedModel.value).toBe(5)

    editInput(getInput(host), '8')
    expect(siblingModel.value).toBe(8)
    parent.value = pane.addFolder({ title: 'Replacement' })
    await nextTick()
    expect(binding?.value).not.toBeNull()
    editInput(getInput(parent.value.element), '9')
    expect(model.value).toBe(9)

    parent.value = folder
    await nextTick()
    expect(binding?.value).toBeNull()
    expect(folder.children).toHaveLength(0)
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('unbinds sibling controls if a subscriber throws during native folder disposal', async () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const folder = pane.addFolder({ title: 'Motion' })
  const error = new Error('Binding subscriber failed')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const report = vi.spyOn(console, 'error').mockImplementation(() => {})

  try {
    const first = scope.run(() => useTweakBinding(folder, ref(1)))
    const second = scope.run(() => useTweakBinding(folder, ref(2)))
    if (!first?.value || !second?.value) {
      throw new Error('Expected a folder with two bindings')
    }
    scope.run(() =>
      watch(
        second,
        () => {
          throw error
        },
        { flush: 'sync' },
      ),
    )

    folder.dispose()
    expect(first.value).toBeNull()
    expect(second.value).toBeNull()
    expect(pane.children).toHaveLength(0)

    await nextTick()
    expect(report).toHaveBeenCalledExactlyOnceWith(error)
  } finally {
    warn.mockRestore()
    report.mockRestore()
    scope.stop()
    pane.dispose()
  }
})

it('can dispose another binding from a subscriber during native folder disposal', () => {
  const scope = effectScope()
  const pane = new Pane({ container: document.createElement('div') })
  const folder = pane.addFolder({ title: 'Motion' })

  try {
    const first = scope.run(() => useTweakBinding(folder, shallowRef(1)))
    const second = scope.run(() => useTweakBinding(folder, shallowRef(2)))
    if (!first?.value || !second?.value) {
      throw new Error('Expected a folder with two bindings')
    }
    scope.run(() =>
      watch(second, () => first.value?.dispose(), { flush: 'sync' }),
    )

    folder.dispose()
    expect(first.value).toBeNull()
    expect(second.value).toBeNull()
    expect(folder.children).toHaveLength(0)
    expect(pane.children).toHaveLength(0)
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('mounts the replacement pane before reporting a configure cleanup error', async () => {
  const scope = effectScope()
  const originalHost = document.createElement('div')
  const replacementHost = document.createElement('div')
  const finalHost = document.createElement('div')
  const host = shallowRef(originalHost)
  const error = new Error('Configure cleanup failed')
  const originalCleanup = vi.fn<() => void>(() => {
    throw error
  })
  const replacementCleanup = vi.fn<() => void>()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const report = vi.spyOn(console, 'error').mockImplementation(() => {})

  try {
    const pane = scope.run(() =>
      useTweakpane(host, {
        configure(instance) {
          return instance.element.parentElement === originalHost
            ? originalCleanup
            : replacementCleanup
        },
      }),
    )
    const original = pane?.value
    expect(original?.element.parentElement).toBe(originalHost)

    host.value = replacementHost
    await nextTick()
    expect(report).toHaveBeenCalledExactlyOnceWith(error)
    expect(originalCleanup).toHaveBeenCalledOnce()
    expect(originalHost.childElementCount).toBe(0)
    expect(pane?.value).not.toBe(original)
    expect(pane?.value?.element.parentElement).toBe(replacementHost)

    original?.dispose()
    expect(pane?.value?.element.parentElement).toBe(replacementHost)
    host.value = finalHost
    await nextTick()
    expect(pane?.value?.element.parentElement).toBe(finalHost)
    expect(replacementHost.childElementCount).toBe(0)
    expect(replacementCleanup).toHaveBeenCalledOnce()

    scope.stop()
    expect(pane?.value).toBeNull()
    expect(finalHost.childElementCount).toBe(0)
    expect(replacementCleanup).toHaveBeenCalledTimes(2)
  } finally {
    warn.mockRestore()
    report.mockRestore()
    scope.stop()
  }
})

it('forwards configure cleanup errors to the component error handler after replacement', async () => {
  const mountPoint = document.createElement('div')
  const originalHost = document.createElement('div')
  const replacementHost = document.createElement('div')
  const host = shallowRef(originalHost)
  const error = new Error('Configure cleanup failed')
  const report = vi.fn<(cause: unknown) => void>()
  let inputAtError: HTMLInputElement | null = null
  const app = createApp({
    setup() {
      const pane = useTweakpane(host, {
        configure(instance) {
          if (instance.element.parentElement !== originalHost) {
            return undefined
          }
          return () => {
            throw error
          }
        },
      })
      useTweakBinding(pane, ref(1))
      return () => null
    },
  })
  app.config.errorHandler = cause => {
    inputAtError = replacementHost.querySelector('input')
    report(cause)
  }

  app.mount(mountPoint)
  try {
    await nextTick()
    expect(originalHost.querySelector('input')).not.toBeNull()
    host.value = replacementHost
    await nextTick()

    expect(originalHost.childElementCount).toBe(0)
    expect(inputAtError).not.toBeNull()
    expect(report).toHaveBeenCalledExactlyOnceWith(error)
  } finally {
    app.unmount()
  }
  expect(replacementHost.childElementCount).toBe(0)
})

it('stops watching the host when standalone pane creation fails', async () => {
  const scope = effectScope()
  const host = shallowRef(document.createElement('div'))
  const original = host.value
  const error = new Error('Configure failed')
  const configure = vi.fn<(pane: Pane) => void>(() => {
    throw error
  })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  try {
    expect(() => scope.run(() => useTweakpane(host, { configure }))).toThrow(
      error,
    )
    expect(original.childElementCount).toBe(0)

    host.value = document.createElement('div')
    await nextTick()
    expect(configure).toHaveBeenCalledOnce()
    expect(host.value.childElementCount).toBe(0)
  } finally {
    warn.mockRestore()
    scope.stop()
  }
})

it('clears managed refs and runs cleanup once when the native pane is disposed', () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const cleanup = vi.fn<() => void>()

  try {
    const pane = scope.run(() =>
      useTweakpane(host, { configure: () => cleanup }),
    )
    const binding = scope.run(() => useTweakBinding(pane, ref(1)))
    const instance = pane?.value
    expect(binding?.value).not.toBeNull()

    instance?.dispose()
    expect(pane?.value).toBeNull()
    expect(binding?.value).toBeNull()
    expect(host.childElementCount).toBe(0)

    instance?.dispose()
    scope.stop()
    expect(cleanup).toHaveBeenCalledTimes(1)
  } finally {
    scope.stop()
  }
})

it('releases the pane and configure resources if configure stops the scope', () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const cleanup = vi.fn<() => void>()

  try {
    const pane = scope.run(() =>
      useTweakpane(host, {
        configure() {
          scope.stop()
          return cleanup
        },
      }),
    )

    expect(pane?.value).toBeNull()
    expect(host.childElementCount).toBe(0)
    expect(cleanup).toHaveBeenCalledTimes(1)
  } finally {
    scope.stop()
  }
})

it('cleans up sibling bindings when a binding subscriber throws during disposal', () => {
  const paneScope = effectScope()
  const bindingScope = effectScope()
  const host = document.createElement('div')
  const error = new Error('Binding subscriber failed')

  try {
    const pane = paneScope.run(() => useTweakpane(host))
    const [first, second] =
      bindingScope.run(() => [
        useTweakBinding(pane, ref(1)),
        useTweakBinding(pane, ref(2)),
      ]) ?? []
    if (!first?.value || !second?.value || !pane?.value) {
      throw new Error('Expected a pane with two bindings')
    }

    bindingScope.run(() =>
      watch(
        first,
        () => {
          throw error
        },
        { flush: 'sync' },
      ),
    )
    expect(() => pane.value?.dispose()).toThrow(error)
    expect(pane.value).toBeNull()
    expect(first.value).toBeNull()
    expect(second.value).toBeNull()
    expect(host.childElementCount).toBe(0)
  } finally {
    bindingScope.stop()
    paneScope.stop()
  }
})

it('finishes scope cleanup when a binding subscriber throws', async () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const otherHost = document.createElement('div')
  const hostRef = shallowRef(host)
  const getHost = vi.fn<() => HTMLElement>(() => hostRef.value)
  const cleanup = vi.fn<() => void>()
  const error = new Error('Binding subscriber failed')
  const scopeCleanup = vi.fn<() => void>()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const report = vi.spyOn(console, 'error').mockImplementation(() => {})

  try {
    const result = scope.run(() => {
      const pane = useTweakpane(getHost, { configure: () => cleanup })
      const binding = useTweakBinding(pane, ref(1))
      watch(
        binding,
        () => {
          throw error
        },
        { flush: 'sync' },
      )
      const otherPane = useTweakpane(otherHost)
      onScopeDispose(scopeCleanup)
      return { pane, binding, otherPane }
    })
    if (!result?.pane.value || !result.binding.value) {
      throw new Error('Expected a pane with a binding')
    }

    scope.stop()
    expect(host.childElementCount).toBe(0)
    expect(otherHost.childElementCount).toBe(0)
    expect(result.pane.value).toBeNull()
    expect(result.binding.value).toBeNull()
    expect(result.otherPane.value).toBeNull()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(scopeCleanup).toHaveBeenCalledOnce()

    hostRef.value = document.createElement('div')
    await nextTick()
    expect(getHost).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledExactlyOnceWith(error)
  } finally {
    warn.mockRestore()
    report.mockRestore()
    scope.stop()
  }
})

it('disposes the new binding if its formatter stops the scope', () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })

  try {
    const binding = scope.run(() =>
      useTweakBinding(pane, ref(1), {
        format(value: number) {
          scope.stop()
          return String(value)
        },
      }),
    )

    expect(binding?.value).toBeNull()
    expect(host.querySelector('input')).toBeNull()
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('syncs model updates made during native binding creation', () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const model = ref(1)

  try {
    scope.run(() =>
      useTweakBinding(pane, model, {
        format(value: number) {
          if (value === 1) {
            model.value = 3
          }
          return String(value)
        },
      }),
    )

    expect(model.value).toBe(3)
    expect(Number(getInput(host).value)).toBe(3)
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('keeps later bindings working when a reactive parent cannot create an input', async () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const parent = shallowRef<Pane | null>(null)
  const error = new Error('Formatter failed')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const report = vi.spyOn(console, 'error').mockImplementation(() => {})
  let shouldFail = true

  try {
    const broken = scope.run(() =>
      useTweakBinding(parent, shallowRef(1), {
        format(value) {
          if (shouldFail) {
            throw error
          }
          return String(value)
        },
      }),
    )
    const healthy = scope.run(() => useTweakBinding(parent, shallowRef(2)))
    parent.value = pane
    await nextTick()

    expect(report).toHaveBeenCalledExactlyOnceWith(error)
    expect(broken?.value).toBeNull()
    expect(healthy?.value).not.toBeNull()
    expect(pane.children).toHaveLength(1)

    parent.value = null
    await nextTick()
    shouldFail = false
    parent.value = pane
    await nextTick()
    expect(broken?.value).not.toBeNull()
    expect(healthy?.value).not.toBeNull()
    expect(pane.children).toHaveLength(2)
  } finally {
    warn.mockRestore()
    report.mockRestore()
    scope.stop()
    pane.dispose()
  }
})

it('stops synchronization when the native binding is disposed directly', async () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const model = ref(1)

  try {
    const binding = scope.run(() => useTweakBinding(pane, model))
    const instance = binding?.value
    if (!instance) {
      throw new Error('Expected a Tweakpane binding')
    }
    const refresh = vi.spyOn(instance, 'refresh')

    instance.dispose()
    expect(binding.value).toBeNull()
    expect(host.querySelector('input')).toBeNull()

    model.value = 2
    await nextTick()
    expect(refresh).not.toHaveBeenCalled()
    instance.dispose()
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('pauses model updates with the Vue scope even when the parent arrived later', async () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const parent = shallowRef<Pane | null>(null)
  const model = ref(1)

  try {
    scope.run(() => useTweakBinding(parent, model))
    parent.value = pane
    await nextTick()
    const input = getInput(host)

    scope.pause()
    model.value = 2
    await nextTick()
    expect(Number(input.value)).toBe(1)

    scope.resume()
    await nextTick()
    expect(Number(input.value)).toBe(2)
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('rejects readonly models before creating an input', () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const model = computed(() => 1)

  try {
    expect(() => scope.run(() => useTweakBinding(pane, model))).toThrow(
      'useTweakBinding requires a writable model',
    )
    expect(host.querySelector('input')).toBeNull()
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('reconciles corrected and rejected writes without feeding refresh events back into the model', async () => {
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const scope = effectScope()
  const speed = shallowRef(1)
  const set = vi.fn<(value: number) => void>(value => {
    if (value >= 0) {
      speed.value = Math.min(value, 5)
    }
  })

  try {
    scope.run(() => {
      useTweakBinding(pane, computed({ get: () => speed.value, set }))
    })
    const input = getInput(host)
    editInput(input, '8')
    expect(speed.value).toBe(5)
    await nextTick()
    expect(Number(input.value)).toBe(5)

    editInput(input, '-1')
    await nextTick()
    expect(Number(input.value)).toBe(5)

    speed.value = 2
    await nextTick()
    expect(Number(input.value)).toBe(2)
    expect(set.mock.calls).toEqual([[8], [-1]])

    scope.stop()
    expect(host.querySelector('input')).toBeNull()
    expect(pane.addButton({ title: 'Still usable' }).title).toBe('Still usable')
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('updates a tab-page binding for reactive coordinate edits and commits point changes as a copy', async () => {
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const scope = effectScope()
  const [page] = pane.addTab({ pages: [{ title: 'Motion' }] }).pages
  const parent = shallowRef(page)
  const position = ref({ x: 0, y: 1, r: 4, name: 'Original' })
  const binding = scope.run(() => useTweakBinding(parent, position))
  try {
    const input = getInput(host)
    const original = position.value
    position.value.x = 2
    await nextTick()
    expect(Number(input.value)).toBe(2)
    expect(position.value).toBe(original)

    position.value.name = 'Updated'
    await nextTick()
    const onChange = vi.fn<(event: { value: typeof position.value }) => void>()
    binding?.value?.on('change', onChange)
    editInput(input, '3')
    expect(position.value).toEqual({ x: 3, y: 1, r: 4, name: 'Updated' })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ value: position.value }),
    )
    expect(position.value).not.toBe(original)
    expect(original.x).toBe(2)

    parent.value = undefined
    await nextTick()
    expect(binding?.value).toBeNull()
    expect(host.querySelector('input')).toBeNull()
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('synchronizes RGB channels for a color with coordinate metadata', async () => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const color = ref({ r: 17, g: 34, b: 51, x: 1, y: 2 })

  try {
    scope.run(() => useTweakBinding(pane, color))
    const input = getInput(host)
    color.value.r = 68
    await nextTick()
    expect(input.value).toBe('{r: 68, g: 34, b: 51}')

    editInput(input, '#776655')
    expect(color.value).toEqual({ r: 119, g: 102, b: 85, x: 1, y: 2 })
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it.each([
  {
    name: 'point',
    initial: { x: 1, y: 2 },
    field: 'x',
    input: '4',
    expected: { x: 4, y: 2 },
  },
  {
    name: 'color',
    initial: { r: 17, g: 34, b: 51 },
    field: 'r',
    input: '#776655',
    expected: { r: 119, g: 102, b: 85 },
  },
])(
  'preserves $name metadata descriptors without invoking accessors on model writes',
  ({ initial, field, input, expected }) => {
    const scope = effectScope()
    const host = document.createElement('div')
    const pane = new Pane({ container: host })
    const metadata = Symbol('metadata')
    const getMetadata = vi.fn<() => string>(() => 'hidden')
    const getLabel = vi.fn<() => string>(() => 'visible')
    const original = Object.defineProperties(
      { ...initial },
      {
        [field]: { writable: false },
        id: { value: 'control' },
        label: { enumerable: true, get: getLabel },
        [metadata]: { configurable: true, get: getMetadata },
      },
    )
    const model = shallowRef(original)

    try {
      scope.run(() => useTweakBinding(pane, model))
      editInput(getInput(host), input)

      expect(getMetadata).not.toHaveBeenCalled()
      expect(getLabel).not.toHaveBeenCalled()
      expect(model.value).toMatchObject(expected)
      expect(model.value).not.toBe(original)
      expect(original).toMatchObject(initial)
      expect(
        Object.getOwnPropertyDescriptor(model.value, field)?.writable,
      ).toBe(true)
      for (const key of ['id', 'label', metadata]) {
        expect(Object.getOwnPropertyDescriptor(model.value, key)).toEqual(
          Object.getOwnPropertyDescriptor(original, key),
        )
      }
      expect(Reflect.get(model.value, metadata)).toBe('hidden')
    } finally {
      scope.stop()
      pane.dispose()
    }
  },
)

it.each([
  {
    name: 'a cross-realm point',
    createPoint: (): TweakPoint => runInNewContext('({ x: 1, y: 2 })'),
    prototype: Object.prototype,
  },
  {
    name: 'a null-prototype point',
    createPoint(): TweakPoint {
      const point = { x: 1, y: 2 }
      Reflect.setPrototypeOf(point, null)
      return point
    },
    prototype: null,
  },
])('synchronizes $name', async ({ createPoint, prototype }) => {
  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const point = createPoint()
  expect(Reflect.getPrototypeOf(point)).not.toBe(Object.prototype)
  const model = ref(point)

  try {
    scope.run(() => useTweakBinding(pane, model))
    const input = getInput(host)
    expect(Number(input.value)).toBe(1)

    model.value.x = 2
    await nextTick()
    expect(Number(input.value)).toBe(2)

    editInput(input, '3')
    expect(model.value).toEqual({ x: 3, y: 2 })
    expect(Reflect.getPrototypeOf(model.value)).toBe(prototype)
  } finally {
    scope.stop()
    pane.dispose()
  }
})

it('rejects class-backed values and accepts a writable computed adapter', () => {
  class Point {
    x = 1
    y = 2

    length() {
      return Math.hypot(this.x, this.y)
    }
  }

  const scope = effectScope()
  const host = document.createElement('div')
  const pane = new Pane({ container: host })
  const model = ref(new Point())

  try {
    expect(() => scope.run(() => useTweakBinding(pane, model))).toThrow(
      'Use a writable computed to adapt a class instance',
    )
    expect(host.querySelector('input')).toBeNull()

    const position = computed({
      get: () => ({ x: model.value.x, y: model.value.y }),
      set(value) {
        model.value.x = value.x
        model.value.y = value.y
      },
    })
    scope.run(() => useTweakBinding(pane, position))
    editInput(getInput(host), '3')

    expect(model.value).toBeInstanceOf(Point)
    expect(model.value.length()).toBe(Math.hypot(3, 2))
  } finally {
    scope.stop()
    pane.dispose()
  }
})
