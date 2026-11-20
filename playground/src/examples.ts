import ColorMixer from './examples/ColorMixer.vue'
import LayoutPresets from './examples/LayoutPresets.vue'
import MotionStage from './examples/MotionStage.vue'
import PaneLifecycle from './examples/PaneLifecycle.vue'
import SignalStudio from './examples/SignalStudio.vue'

export const EXAMPLES = {
  signal: {
    label: 'Signal studio',
    icon: 'i-lucide:audio-waveform',
    filename: 'SignalStudio.vue',
    component: SignalStudio,
    loadSource: () =>
      import('./examples/SignalStudio.vue?raw&highlight').then(
        file => file.default,
      ),
  },
  color: {
    label: 'Color mixer',
    icon: 'i-lucide:palette',
    filename: 'ColorMixer.vue',
    component: ColorMixer,
    loadSource: () =>
      import('./examples/ColorMixer.vue?raw&highlight').then(
        file => file.default,
      ),
  },
  motion: {
    label: 'Motion stage',
    icon: 'i-lucide:orbit',
    filename: 'MotionStage.vue',
    component: MotionStage,
    loadSource: () =>
      import('./examples/MotionStage.vue?raw&highlight').then(
        file => file.default,
      ),
  },
  layout: {
    label: 'Layout presets',
    icon: 'i-lucide:layout-template',
    filename: 'LayoutPresets.vue',
    component: LayoutPresets,
    loadSource: () =>
      import('./examples/LayoutPresets.vue?raw&highlight').then(
        file => file.default,
      ),
  },
  lifecycle: {
    label: 'Pane lifecycle',
    icon: 'i-lucide:refresh-cw',
    filename: 'PaneLifecycle.vue',
    component: PaneLifecycle,
    loadSource: () =>
      import('./examples/PaneLifecycle.vue?raw&highlight').then(
        file => file.default,
      ),
  },
}

export type ExampleId = keyof typeof EXAMPLES
