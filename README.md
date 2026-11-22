# vue-tweakpane

[![CI](https://github.com/ntnyq/vue-tweakpane/workflows/CI/badge.svg)](https://github.com/ntnyq/vue-tweakpane/actions)
[![NPM VERSION](https://img.shields.io/npm/v/vue-tweakpane.svg)](https://www.npmjs.com/package/vue-tweakpane)
[![NPM DOWNLOADS](https://img.shields.io/npm/dy/vue-tweakpane.svg)](https://www.npmjs.com/package/vue-tweakpane)
[![LICENSE](https://img.shields.io/github/license/ntnyq/vue-tweakpane.svg)](https://github.com/ntnyq/vue-tweakpane/blob/main/LICENSE)

Vue 3 composables and template components for managing a Tweakpane panel and synchronizing its controls with Vue state.

## Install

```shell
npm install vue-tweakpane tweakpane vue
```

```shell
yarn add vue-tweakpane tweakpane vue
```

```shell
pnpm add vue-tweakpane tweakpane vue
```

Tweakpane 4.0.5's type declarations rely on `@tweakpane/core`. If your project
uses pnpm with `hoist: false` or Yarn Plug'n'Play, add the following
`packageExtensions` mapping to `pnpm-workspace.yaml` or `.yarnrc.yml` and reinstall.

```yaml
packageExtensions:
  tweakpane@4.0.5:
    dependencies:
      '@tweakpane/core': ^2.0.5
```

## Usage

```vue
<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue'
import { useTweakBinding, useTweakpane } from 'vue-tweakpane'

const hostRef = useTemplateRef<HTMLElement>('hostRef')

const quality = shallowRef<'low' | 'high'>('low')

const pane = useTweakpane(hostRef, {
  title: 'Scene',
  configure(instance) {
    instance.addButton({ title: 'Reset' }).on('click', () => {
      quality.value = 'low'
    })
  },
})

const qualityBinding = useTweakBinding(pane, quality, {
  label: 'Quality',
  options: { Low: 'low', High: 'high' },
})
</script>

<template>
  <div ref="hostRef"></div>
  <p>Quality: {{ quality }}</p>
</template>
```

Call the composables inside component setup or an active Vue effect scope. Both return shallow, read-only refs that expose the native instance when it is available.

- `useTweakpane(host, options?)` creates the pane after mount and disposes it when its host changes or its scope stops. Calling the returned pane's `dispose()` clears its ref and the bindings it owns. `configure` runs for each pane. Use it to add native buttons, folders, tabs, and plugins.
- `useTweakBinding(parent, model, params?)` accepts a native `Pane`, `FolderApi`, or `TabPageApi`. The parent can also be a ref or getter that returns `null` to remove the control. Disposing the binding or a native container that owns it clears the binding's ref and stops synchronization.
- Use a writable ref, property ref, or writable computed as the model. Edits write back immediately, and Vue updates refresh the control. Use `ref()` for objects whose coordinates or color channels you edit in place.
- Supported values include numbers, booleans, strings, and plain RGB(A) or 2D–4D point objects. To bind a class-backed value, expose a plain object from a writable computed and update the instance in its setter. The native `change` event on `qualityBinding.value` infers `value` as `'low' | 'high'`. Tweakpane creates the input from the initial value's kind and its native `BindingParams`. Keep values and list options compatible with that input and the model's type.

### Dispose a native folder

Calling `folder.dispose()` synchronously clears the bindings in that folder and
its descendants. If a binding uses a reactive parent, assign another live folder
to bind the same model again. Native folder disposal also runs cleanup for the
Vue controls mounted in that folder.

### Clean up resources from `configure`

Return a `Disposable` (`() => void`) to clean up resources created in `configure`. It runs before the pane is disposed. If the pane is disposed during `configure`, cleanup runs as soon as `configure` returns. If cleanup throws during a host change or scope teardown, Vue reports the error after attempting the remaining lifecycle work. Using `hostRef` from above, this example removes a window listener that refreshes the pane when the window regains focus.

```ts
import { useTweakpane } from 'vue-tweakpane'
import type { Disposable } from 'vue-tweakpane'

useTweakpane(hostRef, {
  configure(pane): Disposable {
    const refresh = () => pane.refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  },
})
```

## Template components

Import `TweakPane`, `TweakFolder`, `TweakBinding`, `TweakButton`, and `TweakBlade`
from `vue-tweakpane/components` to lay out controls in a Vue template.

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import {
  TweakBinding,
  TweakButton,
  TweakFolder,
  TweakPane,
} from 'vue-tweakpane/components'

const quality = shallowRef<'low' | 'high'>('low')
const showSpeed = shallowRef(true)
const speed = shallowRef(1)
</script>

<template>
  <TweakPane title="Scene">
    <TweakFolder title="Rendering">
      <TweakBinding
        v-model="quality"
        :params="{ label: 'Quality', options: { Low: 'low', High: 'high' } }"
      />
      <TweakBinding
        v-if="showSpeed"
        v-model="speed"
        :params="{ label: 'Speed', min: 0, max: 4 }"
      />
      <TweakButton
        title="Toggle speed"
        @click="showSpeed = !showSpeed"
      />
    </TweakFolder>
  </TweakPane>
</template>
```

`TweakBinding` infers its value type from `v-model` and accepts the same writable
binding options as `useTweakBinding()`. Add stable keys to `v-for` items so Vue
preserves their identity across reorders. Reordering can recreate some native
controls and reset their focus or plugin state. Vue model values are preserved.
Options such as `params`, `title`, `expanded`, and `plugins` are read at
creation. Change a component's `key` to recreate it with new options.

Pass plugin bundles as `:plugins="[MyPlugin]"` on `TweakPane`. `TweakBlade`
receives a factory through `create`. Use the supplied index and return the
native blade so the component can dispose it. For example,
`:create="(rack, index) => rack.addBlade({ view: 'separator', index })"`.
If the factory throws, roll back any native controls and external resources it
created before rethrowing. During a dynamic update, Vue receives the error after
the rack finishes mounting the other controls it can. If the rack is disposed
while the factory runs, the component immediately disposes the returned blade.

## Playground

Run `pnpm play:dev` locally or open the [online playground](https://vue-tweakpane.ntnyq.dev).

## License

[MIT](./LICENSE) License © 2026-PRESENT [ntnyq](https://github.com/ntnyq)
