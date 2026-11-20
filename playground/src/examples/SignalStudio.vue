<script setup lang="ts">
import {
  useElementSize,
  useMutationObserver,
  usePreferredReducedMotion,
  useRafFn,
  useToggle,
} from '@vueuse/core'
import type { FolderApi } from 'tweakpane'
import { ref, shallowRef, toRefs, useTemplateRef, watchEffect } from 'vue'
import { useTweakBinding, useTweakpane } from 'vue-tweakpane'
import ExampleFrame from '../components/ExampleFrame.vue'
import ExampleStage from '../components/ExampleStage.vue'
import ToolbarButton from '../components/ToolbarButton.vue'

const DEFAULT_SETTINGS = {
  shape: 'sine',
  frequency: 2,
  amplitude: 0.65,
  phase: 0,
  trace: '#42947a',
  grid: true,
} as const

const PLOT_LEFT = 43
const PLOT_TOP = 18
const PLOT_DURATION = 1.5

const settings = ref<{
  shape: 'sine' | 'square' | 'triangle' | 'sawtooth'
  frequency: number
  amplitude: number
  phase: number
  trace: string
  grid: boolean
}>({ ...DEFAULT_SETTINGS })
const { shape, frequency, amplitude, phase, trace, grid } = toRefs(
  settings.value,
)
const hostRef = useTemplateRef('hostRef')
const canvasRef = useTemplateRef('canvasRef')
const waveform = shallowRef<FolderApi>()
const appearance = shallowRef<FolderApi>()
const offset = shallowRef(0)
const reducedMotion = usePreferredReducedMotion()
const [isPlaying, setIsPlaying] = useToggle(reducedMotion.value !== 'reduce')
const { width, height } = useElementSize(canvasRef)

function reset() {
  Object.assign(settings.value, DEFAULT_SETTINGS)
  offset.value = 0
}

useTweakpane(hostRef, {
  title: 'Signal',
  configure(pane) {
    waveform.value = pane.addFolder({ title: 'Waveform' })
    appearance.value = pane.addFolder({ title: 'Appearance' })
    pane.addButton({ title: 'Reset parameters' }).on('click', reset)
  },
})

useTweakBinding(waveform, shape, {
  label: 'Shape',
  options: {
    Sine: 'sine',
    Square: 'square',
    Triangle: 'triangle',
    Sawtooth: 'sawtooth',
  },
})
useTweakBinding(waveform, frequency, {
  label: 'Frequency',
  min: 0.5,
  max: 8,
  step: 0.1,
})
useTweakBinding(waveform, amplitude, {
  label: 'Amplitude',
  min: 0,
  max: 1,
  step: 0.01,
})
useTweakBinding(waveform, phase, { label: 'Phase', min: 0, max: 360, step: 1 })
useTweakBinding(appearance, trace, { label: 'Trace', view: 'color' })
useTweakBinding(appearance, grid, { label: 'Grid' })

const { pause, resume } = useRafFn(
  ({ delta }) => {
    offset.value =
      (offset.value + Math.min(delta, 50) * 0.00035 * frequency.value) % 1
  },
  { immediate: false },
)

watchEffect(() => {
  if (width.value > 0 && isPlaying.value) {
    resume()
  } else {
    pause()
  }
})

function sample(cycle: number) {
  const progress = cycle % 1
  switch (shape.value) {
    case 'square':
      return progress < 0.5 ? 1 : -1
    case 'triangle':
      return 1 - 4 * Math.abs(progress - 0.5)
    case 'sawtooth':
      return 2 * progress - 1
    default:
      return Math.sin(cycle * Math.PI * 2)
  }
}

function draw() {
  const element = canvasRef.value
  const w = width.value
  const h = height.value
  const context = element?.getContext('2d')
  if (!element || !context || w < 100 || h < 100) {
    return
  }

  const ratio = window.devicePixelRatio
  const pixelsWide = Math.round(w * ratio)
  const pixelsHigh = Math.round(h * ratio)
  if (element.width !== pixelsWide || element.height !== pixelsHigh) {
    element.width = pixelsWide
    element.height = pixelsHigh
  }

  const styles = getComputedStyle(element)
  const plotWidth = w - PLOT_LEFT - 20
  const plotHeight = h - PLOT_TOP - 28
  const baseline = PLOT_TOP + plotHeight / 2
  const columns = w < 420 ? 3 : 6
  const rows = h < 300 ? 4 : 8

  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, w, h)
  context.lineWidth = 1
  context.font = '11px ui-monospace, monospace'
  context.fillStyle = styles.color
  context.strokeStyle = styles.getPropertyValue('--chart-grid') || '#d5dde2'

  if (grid.value) {
    context.beginPath()
    context.textAlign = 'center'
    for (let column = 0; column <= columns; column++) {
      const x = PLOT_LEFT + (column / columns) * plotWidth
      context.moveTo(x, PLOT_TOP)
      context.lineTo(x, PLOT_TOP + plotHeight)
      context.fillText(
        `${((column / columns) * PLOT_DURATION).toFixed(2)} s`,
        x,
        h - 9,
      )
    }
    context.textAlign = 'right'
    for (let row = 0; row <= rows; row++) {
      const y = PLOT_TOP + (row / rows) * plotHeight
      context.moveTo(PLOT_LEFT, y)
      context.lineTo(PLOT_LEFT + plotWidth, y)
      context.fillText((1 - (row / rows) * 2).toFixed(2), PLOT_LEFT - 7, y + 4)
    }
    context.stroke()
  }

  context.strokeStyle = styles.getPropertyValue('--chart-axis') || '#84929d'
  context.setLineDash([4, 4])
  context.beginPath()
  context.moveTo(PLOT_LEFT, baseline)
  context.lineTo(PLOT_LEFT + plotWidth, baseline)
  context.stroke()
  context.setLineDash([])

  context.strokeStyle = trace.value
  context.lineWidth = 2
  context.beginPath()
  const phaseOffset = offset.value + phase.value / 360
  for (let point = 0; point <= Math.ceil(plotWidth); point++) {
    const x = PLOT_LEFT + Math.min(point, plotWidth)
    const seconds = ((x - PLOT_LEFT) / plotWidth) * PLOT_DURATION
    const signal = sample(seconds * frequency.value + phaseOffset)
    const y = baseline - signal * amplitude.value * plotHeight * 0.48
    if (point === 0) {
      context.moveTo(x, y)
    } else {
      context.lineTo(x, y)
    }
  }
  context.stroke()
}

watchEffect(draw, { flush: 'post' })
useMutationObserver(document.documentElement, draw, {
  attributes: true,
  attributeFilter: ['class'],
})
</script>

<template>
  <ExampleFrame>
    <ExampleStage>
      <canvas
        ref="canvasRef"
        class="absolute inset-0 size-full text-muted"
        role="img"
        :aria-label="`${shape} waveform at ${frequency.toFixed(1)} hertz`"
      ></canvas>
    </ExampleStage>
    <template #stats>
      <div>
        <dt>Frequency</dt>
        <dd>{{ frequency.toFixed(1) }} Hz</dd>
      </div>
      <div>
        <dt>Amplitude</dt>
        <dd>{{ amplitude.toFixed(2) }}</dd>
      </div>
      <div>
        <dt>Phase</dt>
        <dd>{{ phase }}°</dd>
      </div>
    </template>
    <template #actions>
      <ToolbarButton
        :icon="isPlaying ? 'i-lucide:pause' : 'i-lucide:play'"
        @click="setIsPlaying()"
      >
        {{ isPlaying ? 'Pause' : 'Play' }}
      </ToolbarButton>
      <ToolbarButton
        icon="i-lucide:rotate-ccw"
        @click="reset"
        >Reset</ToolbarButton
      >
    </template>
    <template #controls>
      <div
        ref="hostRef"
        class="rounded-[6px] border border-stroke"
        aria-label="Signal controls"
        role="group"
      ></div>
    </template>
  </ExampleFrame>
</template>
