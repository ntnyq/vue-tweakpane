// @vitest-environment happy-dom

import type { BladeApi, FolderApi, Pane } from 'tweakpane'
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
    expect(inputFor(host, 'C')).toBe(c)
    expect(inputFor(host, 'A')).not.toBe(a)
    expect(Number(inputFor(host, 'B').value)).toBe(12)
    editInput(b, '42')
    expect(values.B.value).toBe(12)

    editInput(c, '13')
    expect(values.C.value).toBe(13)
    host.querySelector<HTMLButtonElement>('button.tp-btnv_b')?.click()
    expect(reset).toHaveBeenCalledOnce()
    await nextTick()
    expect(Number(c.value)).toBe(3)

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
