// @vitest-environment happy-dom

import { Pane } from 'tweakpane'
import type { BladeApi, FolderApi } from 'tweakpane'
import { expect, it, vi } from 'vitest'
import { createApp, Fragment, h, nextTick, shallowRef } from 'vue'
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
