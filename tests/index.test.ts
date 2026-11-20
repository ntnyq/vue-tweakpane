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

    receivingScope.stop()
    expect(binding?.value).toBeNull()
    expect(receivingHost.querySelector('input')).toBeNull()
  } finally {
    bindingScope.stop()
    originalScope.stop()
    receivingScope.stop()
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
