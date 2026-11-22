// @vitest-environment happy-dom

import { BladeApi, BladeController, createPlugin } from '@tweakpane/core'
import type { BaseBladeParams, BladePlugin } from '@tweakpane/core'
import { Pane } from 'tweakpane'
import type { FolderApi } from 'tweakpane'
import { expect, it, vi } from 'vitest'
import {
  createApp,
  Fragment,
  h,
  nextTick,
  shallowReactive,
  shallowRef,
} from 'vue'
import {
  TweakBinding,
  TweakBlade,
  TweakButton,
  TweakFolder,
  TweakPane,
} from '../src/components'

function bindingLabels(host: HTMLElement) {
  return [...host.querySelectorAll('.tp-lblv_l')]
    .map(label => label.textContent)
    .filter(Boolean)
}

function inputFor(host: HTMLElement, name: string) {
  const label = [...host.querySelectorAll('.tp-lblv_l')].find(
    candidate => candidate.textContent === name,
  )
  const input = label?.parentElement?.querySelector('input')
  if (!input) {
    throw new Error(`Expected an input for ${name}`)
  }
  return input
}

function editInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('change'))
}

function nativeButtons(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLButtonElement>('button.tp-btnv_b')]
}

it('inserts a conditional binding and reorders keyed controls without losing their models', async () => {
  const host = document.createElement('div')
  const showB = shallowRef(false)
  const values = { A: shallowRef(1), B: shallowRef(2), C: shallowRef(3) }
  const keys = shallowRef<(keyof typeof values)[]>(['A', 'B', 'C'])
  const reset = vi.fn<() => void>(() => {
    values.C.value = 3
  })

  function binding(key: keyof typeof values) {
    return h(TweakBinding<number>, {
      key,
      modelValue: values[key].value,
      'onUpdate:modelValue': (value: number) => (values[key].value = value),
      params: { label: key },
    })
  }

  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () => [
        h('div', [
          h(
            Fragment,
            keys.value.filter(key => key !== 'B' || showB.value).map(binding),
          ),
        ]),
        h(TweakButton, { title: 'Reset', onClick: reset }),
      ]),
  })

  app.mount(host)
  try {
    expect(bindingLabels(host)).toEqual(['A', 'C'])
    const a = inputFor(host, 'A')
    const c = inputFor(host, 'C')

    showB.value = true
    await nextTick()
    expect(bindingLabels(host)).toEqual(['A', 'B', 'C'])
    expect(inputFor(host, 'A')).toBe(a)
    expect(inputFor(host, 'C')).toBe(c)
    const b = inputFor(host, 'B')
    editInput(b, '12')
    expect(values.B.value).toBe(12)

    keys.value = ['C', 'A', 'B']
    await vi.waitFor(() => expect(bindingLabels(host)).toEqual(['C', 'A', 'B']))
    expect(inputFor(host, 'C')).not.toBe(c)
    expect(inputFor(host, 'A')).toBe(a)
    expect(inputFor(host, 'B')).toBe(b)
    expect(Number(inputFor(host, 'B').value)).toBe(12)
    editInput(c, '42')
    expect(values.C.value).toBe(3)

    editInput(inputFor(host, 'C'), '13')
    expect(values.C.value).toBe(13)
    host.querySelector<HTMLButtonElement>('button.tp-btnv_b')?.click()
    expect(reset).toHaveBeenCalledOnce()
    await nextTick()
    expect(Number(inputFor(host, 'C').value)).toBe(3)

    showB.value = false
    await nextTick()
    expect(bindingLabels(host)).toEqual(['C', 'A'])
  } finally {
    app.unmount()
  }
})

it('mounts later controls after a dynamic blade factory fails and retries in order', async () => {
  const host = document.createElement('div')
  const showBlade = shallowRef(false)
  const buttons = shallowRef(['Tail'])
  const click = vi.fn<() => void>()
  const onError = vi.fn<(error: unknown) => void>()
  const error = new Error('Blade factory failed')
  let shouldFail = true

  function create(rack: Pane | FolderApi, index: number) {
    const blade = rack.addButton({ title: 'Blade', index })
    if (shouldFail) {
      blade.dispose()
      throw error
    }
    return blade
  }

  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () => [
        showBlade.value ? h(TweakBlade, { create }) : null,
        ...buttons.value.map(title =>
          h(TweakButton, { key: title, title, onClick: click }),
        ),
      ]),
  })
  app.config.errorHandler = onError

  app.mount(host)
  try {
    const [tail] = nativeButtons(host)
    showBlade.value = true
    buttons.value = ['Next', 'Tail']
    await nextTick()

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]).toBe(error)
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'Next',
      'Tail',
    ])
    const [next, retainedTail] = nativeButtons(host)
    expect(retainedTail).toBe(tail)
    next?.click()
    expect(click).toHaveBeenCalledOnce()

    shouldFail = false
    buttons.value = ['Next', 'Tail', 'Added']
    await nextTick()
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'Blade',
      'Next',
      'Tail',
      'Added',
    ])
    expect(nativeButtons(host)[1]).toBe(next)
  } finally {
    app.unmount()
  }
})

it('keeps valid controls when a blade fails in a dynamically inserted folder', async () => {
  const host = document.createElement('div')
  const showFolder = shallowRef(false)
  const click = vi.fn<() => void>()
  const error = new Error('Nested blade factory failed')
  const titlesAtError: (string | null)[][] = []

  const onError = vi.fn<(error: unknown) => void>(() => {
    titlesAtError.push(nativeButtons(host).map(button => button.textContent))
  })
  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () =>
        showFolder.value
          ? [
              h(TweakFolder, { title: 'Options' }, () => [
                h(TweakButton, { title: 'Before' }),
                h(TweakBlade, {
                  create() {
                    throw error
                  },
                }),
                h(TweakButton, { title: 'After', onClick: click }),
              ]),
              h(TweakButton, { title: 'Outside' }),
            ]
          : [],
      ),
  })
  app.config.errorHandler = onError

  app.mount(host)
  try {
    showFolder.value = true
    await nextTick()

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]).toBe(error)
    expect(titlesAtError[0]).toEqual(['Before', 'After', 'Outside'])
    expect(host.querySelector('button.tp-fldv_b')?.textContent).toBe('Options')
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'Before',
      'After',
      'Outside',
    ])
    nativeButtons(host)[1]?.click()
    expect(click).toHaveBeenCalledOnce()
  } finally {
    app.unmount()
  }
})

it('finishes reordering a rack before reporting a control cleanup error', async () => {
  const host = document.createElement('div')
  const reordered = shallowRef(false)
  const error = new Error('Blade cleanup failed')
  const titlesAtError: (string | null)[][] = []
  const onError = vi.fn<(cause: unknown) => void>(() => {
    titlesAtError.push(nativeButtons(host).map(button => button.textContent))
  })
  let needsError = true

  function create(rack: Pane | FolderApi, index: number) {
    const button = rack.addButton({ title: 'Blade', index })
    const dispose = button.dispose.bind(button)
    button.dispose = () => {
      if (needsError) {
        needsError = false
        throw error
      }
      dispose()
    }
    return button
  }

  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () => {
        const blade = h(TweakBlade, { key: 'blade', create })
        const first = h(TweakButton, { key: 'first', title: 'First' })
        const second = h(TweakButton, { key: 'second', title: 'Second' })
        const last = h(TweakButton, { key: 'last', title: 'Last' })
        return reordered.value
          ? [first, second, blade, last]
          : [blade, first, second]
      }),
  })
  app.config.errorHandler = onError

  app.mount(host)
  try {
    const [, first, second] = nativeButtons(host)
    reordered.value = true
    await nextTick()

    expect(onError).toHaveBeenCalledExactlyOnceWith(
      error,
      expect.anything(),
      expect.any(String),
    )
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'First',
      'Second',
      'Blade',
      'Last',
    ])
    expect(titlesAtError).toEqual([['First', 'Second', 'Blade', 'Last']])
    expect(nativeButtons(host)[0]).toBe(first)
    expect(nativeButtons(host)[1]).toBe(second)
  } finally {
    app.unmount()
  }
})

it('releases Vue controls when their native folder is disposed directly', () => {
  const host = document.createElement('div')
  const click = vi.fn<() => void>()
  const release = vi.fn<() => void>()
  let folder: Pane | FolderApi | undefined

  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () =>
        h(TweakFolder, { title: 'Options' }, () => [
          h(TweakButton, { title: 'Action', onClick: click }),
          h(TweakBlade, {
            create(rack, index) {
              folder = rack
              const blade = rack.addBlade({ view: 'separator', index })
              const dispose = blade.dispose.bind(blade)
              blade.dispose = () => {
                release()
                dispose()
              }
              return blade
            },
          }),
        ]),
      ),
  })

  app.mount(host)
  try {
    const [button] = nativeButtons(host)
    if (!folder || !button) {
      throw new Error('Expected a native folder and button')
    }
    folder.dispose()
    button.click()

    expect(release).toHaveBeenCalledOnce()
    expect(click).not.toHaveBeenCalled()
    expect(nativeButtons(host)).toHaveLength(0)
  } finally {
    app.unmount()
  }
  expect(release).toHaveBeenCalledOnce()
})

it('keeps other panes working after an unhandled initial blade factory error', async () => {
  const host = document.createElement('div')
  const showButton = shallowRef(false)
  const error = new Error('Initial blade factory failed')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const report = vi.spyOn(console, 'error').mockImplementation(() => {})
  const app = createApp({
    setup: () => () =>
      h(Fragment, null, [
        h(TweakPane, null, () =>
          h(TweakBlade, {
            create() {
              throw error
            },
          }),
        ),
        h(TweakPane, null, () =>
          showButton.value ? h(TweakButton, { title: 'Ready' }) : null,
        ),
      ]),
  })

  try {
    app.mount(host)
    showButton.value = true
    await nextTick()

    expect(report).toHaveBeenCalledExactlyOnceWith(error)
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'Ready',
    ])
  } finally {
    warn.mockRestore()
    report.mockRestore()
    app.unmount()
  }
})

it.each(['pane', 'folder'])(
  'immediately disposes a blade returned after its %s is disposed',
  async container => {
    const host = document.createElement('div')
    const showBlade = shallowRef(false)
    const onError = vi.fn<(error: unknown) => void>()
    const disposeBlade = vi.fn<() => void>()
    const createLater = vi.fn<
      (rack: Pane | FolderApi, index: number) => BladeApi
    >((rack, index) => rack.addBlade({ view: 'separator', index }))
    const create = vi.fn<(rack: Pane | FolderApi) => BladeApi>(rack => {
      rack.dispose()
      const blade = rack.addBlade({ view: 'separator' })
      const dispose = blade.dispose.bind(blade)
      blade.dispose = () => {
        disposeBlade()
        dispose()
      }
      return blade
    })

    function controls() {
      return showBlade.value
        ? [h(TweakBlade, { create }), h(TweakBlade, { create: createLater })]
        : []
    }

    const app = createApp({
      setup: () => () =>
        h(TweakPane, null, () =>
          container === 'folder'
            ? h(TweakFolder, { title: 'Options' }, controls)
            : controls(),
        ),
    })
    app.config.errorHandler = onError

    app.mount(host)
    try {
      showBlade.value = true
      await nextTick()

      expect(create).toHaveBeenCalledOnce()
      expect(create.mock.calls[0]?.[0].children).toHaveLength(0)
      expect(disposeBlade).toHaveBeenCalledOnce()
      expect(createLater).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
    } finally {
      app.unmount()
    }
    expect(disposeBlade).toHaveBeenCalledOnce()
  },
)

it('inserts parent controls in order after a blade disposes its folder', async () => {
  const host = document.createElement('div')
  const showBlade = shallowRef(false)
  const showNewButton = shallowRef(false)

  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () => [
        h(TweakFolder, { key: 'folder', title: 'Options' }, () =>
          showBlade.value
            ? h(TweakBlade, {
                create(rack) {
                  rack.dispose()
                  return rack.addBlade({ view: 'separator' })
                },
              })
            : [],
        ),
        showNewButton.value
          ? h(TweakButton, { key: 'new', title: 'New' })
          : null,
        h(TweakButton, { key: 'tail', title: 'Tail' }),
      ]),
  })

  app.mount(host)
  try {
    const [tail] = nativeButtons(host)
    showBlade.value = true
    await nextTick()
    expect(host.querySelector('button.tp-fldv_b')).toBeNull()

    showNewButton.value = true
    await nextTick()
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'New',
      'Tail',
    ])
    expect(nativeButtons(host)[1]).toBe(tail)
    expect(host.querySelector('button.tp-fldv_b')).toBeNull()
  } finally {
    app.unmount()
  }
})

it('uses the current native index after an earlier folder is disposed in the same update', async () => {
  const host = document.createElement('div')
  const insertControls = shallowRef(false)
  let folder: FolderApi | undefined

  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () => [
        h(TweakFolder, { key: 'folder', title: 'Options' }, () =>
          h(TweakBlade, {
            create(rack, index) {
              folder = rack
              return rack.addBlade({ view: 'separator', index })
            },
          }),
        ),
        ...(insertControls.value
          ? [
              h(TweakBlade, {
                key: 'trigger',
                create(rack, index) {
                  if (!folder) {
                    throw new Error('Expected a Tweakpane folder')
                  }
                  const button = rack.addButton({ title: 'Trigger', index })
                  folder.dispose()
                  return button
                },
              }),
              h(TweakButton, { key: 'new', title: 'New' }),
            ]
          : []),
        h(TweakButton, { key: 'tail', title: 'Tail' }),
      ]),
  })

  app.mount(host)
  try {
    const [tail] = nativeButtons(host)
    insertControls.value = true
    await nextTick()

    expect(host.querySelector('button.tp-fldv_b')).toBeNull()
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'Trigger',
      'New',
      'Tail',
    ])
    expect(nativeButtons(host)[2]).toBe(tail)
  } finally {
    app.unmount()
  }
})

it('skips a disposed native folder returned by a blade factory when inserting controls', async () => {
  const host = document.createElement('div')
  const showNewButton = shallowRef(false)
  let folder: FolderApi | undefined

  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () => [
        h(TweakBlade, {
          key: 'folder',
          create(rack, index) {
            folder = rack.addFolder({ title: 'Options', index })
            return folder
          },
        }),
        showNewButton.value
          ? h(TweakButton, { key: 'new', title: 'New' })
          : null,
        h(TweakButton, { key: 'tail', title: 'Tail' }),
      ]),
  })

  app.mount(host)
  try {
    const [tail] = nativeButtons(host)
    if (!folder) {
      throw new Error('Expected a Tweakpane folder')
    }
    folder.dispose()
    showNewButton.value = true
    await nextTick()

    expect(host.querySelector('button.tp-fldv_b')).toBeNull()
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'New',
      'Tail',
    ])
    expect(nativeButtons(host)[1]).toBe(tail)
  } finally {
    app.unmount()
  }
})

it('inserts controls in template order after a shallow-reactive blade', async () => {
  const host = document.createElement('div')
  const showMiddle = shallowRef(false)
  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () => [
        h(TweakBlade, {
          key: 'first',
          create: (rack, index) =>
            shallowReactive(rack.addButton({ title: 'First', index })),
        }),
        showMiddle.value
          ? h(TweakButton, { key: 'middle', title: 'Middle' })
          : null,
        h(TweakButton, { key: 'last', title: 'Last' }),
      ]),
  })

  app.mount(host)
  try {
    const [first, last] = nativeButtons(host)
    expect(first?.textContent).toBe('First')
    expect(last?.textContent).toBe('Last')

    showMiddle.value = true
    await nextTick()

    const [retainedFirst, middle, retainedLast] = nativeButtons(host)
    expect(retainedFirst).toBe(first)
    expect(middle?.textContent).toBe('Middle')
    expect(retainedLast).toBe(last)
  } finally {
    app.unmount()
  }
})

it('inserts controls in template order after a plugin returns a shallow-reactive blade', () => {
  const host = document.createElement('div')
  const view = 'reactive-test-blade'
  class ReactiveBladeController extends BladeController {}

  const plugin = createPlugin<BladePlugin<BaseBladeParams>>({
    id: view,
    type: 'blade',
    accept: params => (params['view'] === view ? { params: { view } } : null),
    controller({ blade, document, viewProps }) {
      const element = document.createElement('button')
      element.classList.add('tp-btnv_b')
      element.textContent = 'First'
      return new ReactiveBladeController({
        blade,
        view: { element },
        viewProps,
      })
    },
    api: ({ controller }) =>
      controller instanceof ReactiveBladeController
        ? shallowReactive(new BladeApi(controller))
        : null,
  })

  const app = createApp({
    setup: () => () =>
      h(TweakPane, { plugins: [{ id: view, plugin }] }, () => [
        h(TweakBlade, {
          create: (rack, index) => rack.addBlade({ view, index }),
        }),
        h(TweakButton, { title: 'Last' }),
      ]),
  })

  app.mount(host)
  try {
    expect(nativeButtons(host).map(button => button.textContent)).toEqual([
      'First',
      'Last',
    ])
  } finally {
    app.unmount()
  }
})

it('disposes nested bindings and blades before their folders on removal and pane unmount', async () => {
  const host = document.createElement('div')
  const showFolder = shallowRef(true)
  const model = shallowRef(2)
  const disposed: string[] = []

  function trackDisposal(api: BladeApi, label: string, check?: () => void) {
    const dispose = api.dispose.bind(api)
    vi.spyOn(api, 'dispose').mockImplementation(() => {
      check?.()
      disposed.push(label)
      dispose()
    })
  }

  function createBlade(label: string) {
    return (rack: Pane | FolderApi, index: number) => {
      trackDisposal(rack, label, () => expect(rack.children).toHaveLength(0))
      const blade = rack.addBlade({ view: 'separator', index })
      trackDisposal(blade, `${label} blade`)
      return blade
    }
  }

  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () =>
        showFolder.value
          ? h(TweakFolder, { title: 'Outer' }, () => [
              h(TweakBlade, { create: createBlade('outer') }),
              h(TweakFolder, { title: 'Inner' }, () => [
                h(TweakBinding<number>, {
                  modelValue: model.value,
                  'onUpdate:modelValue': (value: number) =>
                    (model.value = value),
                  params: { label: 'Level' },
                }),
                h(TweakBlade, { create: createBlade('inner') }),
              ]),
            ])
          : null,
      ),
  })

  app.mount(host)
  try {
    const input = inputFor(host, 'Level')
    showFolder.value = false
    await nextTick()
    expect(bindingLabels(host)).toEqual([])
    expect(disposed).toEqual(['inner blade', 'inner', 'outer blade', 'outer'])

    editInput(input, '9')
    expect(model.value).toBe(2)
    model.value = 5
    showFolder.value = true
    await nextTick()
    expect(Number(inputFor(host, 'Level').value)).toBe(5)
  } finally {
    app.unmount()
  }
  expect(disposed).toEqual([
    'inner blade',
    'inner',
    'outer blade',
    'outer',
    'inner blade',
    'inner',
    'outer blade',
    'outer',
  ])
  expect(host.childElementCount).toBe(0)
})

it('preserves the fold state of a keyed folder rebuilt during reordering', async () => {
  const host = document.createElement('div')
  const folderFirst = shallowRef(false)
  const addFolder = vi.spyOn(Pane.prototype, 'addFolder')
  const addButton = vi.spyOn(Pane.prototype, 'addButton')
  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () => {
        const folder = h(TweakFolder, { key: 'options', title: 'Options' })
        const buttons = [
          h(TweakButton, { key: 'reset', title: 'Reset' }),
          h(TweakButton, { key: 'apply', title: 'Apply' }),
        ]
        return folderFirst.value ? [folder, ...buttons] : [...buttons, folder]
      }),
  })

  function controlLabels() {
    return Array.from(
      host.querySelectorAll('button.tp-btnv_b, button.tp-fldv_b'),
      button => button.textContent,
    )
  }

  app.mount(host)
  try {
    const original = addFolder.mock.results[0]!.value
    original.element.querySelector('button')!.click()
    expect(original.expanded).toBe(false)

    folderFirst.value = true
    await vi.waitFor(() =>
      expect(controlLabels()).toEqual(['Options', 'Reset', 'Apply']),
    )
    expect(addFolder).toHaveBeenCalledTimes(2)
    expect(addButton).toHaveBeenCalledTimes(2)
    const rebuilt = addFolder.mock.results[1]!.value
    expect(rebuilt.expanded).toBe(false)

    rebuilt.element.querySelector('button')!.click()
    expect(rebuilt.expanded).toBe(true)

    folderFirst.value = false
    await vi.waitFor(() =>
      expect(controlLabels()).toEqual(['Reset', 'Apply', 'Options']),
    )
    expect(addFolder).toHaveBeenCalledTimes(3)
    expect(addButton).toHaveBeenCalledTimes(2)
    expect(addFolder.mock.results[2]!.value.expanded).toBe(true)
  } finally {
    app.unmount()
    addButton.mockRestore()
    addFolder.mockRestore()
  }
})

it('retains the longest ordered sequence and retires listeners across mixed rack updates', async () => {
  const host = document.createElement('div')
  const keys = shallowRef(['A', 'B', 'C', 'D', 'E'])
  const models = Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E', 'F'].map(key => [key, shallowRef(1)]),
  )
  const addBinding = vi.spyOn(Pane.prototype, 'addBinding')
  const app = createApp({
    setup: () => () =>
      h(TweakPane, null, () =>
        keys.value.map(key =>
          h(TweakBinding<number>, {
            key,
            modelValue: models[key]!.value,
            'onUpdate:modelValue': (value: number) =>
              (models[key]!.value = value),
            params: { label: key },
          }),
        ),
      ),
  })
  app.mount(host)
  try {
    const original = new Map(keys.value.map(key => [key, inputFor(host, key)]))
    const apis = addBinding.mock.results.map(result => result.value)
    expect(addBinding).toHaveBeenCalledTimes(5)

    keys.value = ['E', 'A', 'B', 'C', 'D']
    await vi.waitFor(() => expect(bindingLabels(host)).toEqual(keys.value))
    for (const key of ['A', 'B', 'C', 'D']) {
      expect(inputFor(host, key)).toBe(original.get(key))
    }
    expect(addBinding).toHaveBeenCalledTimes(6)
    for (const [index, key] of ['A', 'B', 'C', 'D'].entries()) {
      expect(apis[index].element.contains(inputFor(host, key))).toBe(true)
    }
    expect(
      addBinding.mock.calls.filter(call => call[2]?.label === 'E'),
    ).toHaveLength(2)
    expect(inputFor(host, 'E')).not.toBe(original.get('E'))
    editInput(original.get('E')!, '99')
    expect(models['E']!.value).toBe(1)
    editInput(inputFor(host, 'E'), '7')
    expect(models['E']!.value).toBe(7)

    // A new array and model change without a reorder must not remount controls.
    keys.value = [...keys.value]
    models['A']!.value = 5
    await nextTick()
    expect(addBinding).toHaveBeenCalledTimes(6)
    expect(inputFor(host, 'A')).toBe(original.get('A'))

    // Remove B, insert F, and move E back to the end in the same update.
    const retiredE = inputFor(host, 'E')
    keys.value = ['A', 'F', 'C', 'D', 'E']
    await vi.waitFor(() => expect(bindingLabels(host)).toEqual(keys.value))
    for (const key of ['A', 'C', 'D']) {
      expect(inputFor(host, key)).toBe(original.get(key))
    }
    expect(addBinding).toHaveBeenCalledTimes(8)
    editInput(retiredE, '88')
    editInput(original.get('B')!, '88')
    expect(models['E']!.value).toBe(7)
    expect(models['B']!.value).toBe(1)
    expect(Number(inputFor(host, 'E').value)).toBe(7)
  } finally {
    app.unmount()
    addBinding.mockRestore()
  }
})
