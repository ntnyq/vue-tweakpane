<script setup lang="ts">
import {
  useElementSize,
  usePreferredReducedMotion,
  useRafFn,
  useToggle,
} from '@vueuse/core'
import type { FolderApi } from 'tweakpane'
import { computed, ref, shallowRef, useTemplateRef, watchEffect } from 'vue'
import { useTweakBinding, useTweakpane } from 'vue-tweakpane'
import ExampleFrame from '../components/ExampleFrame.vue'
import ExampleStage from '../components/ExampleStage.vue'
import ToolbarButton from '../components/ToolbarButton.vue'

const ORIGIN = { x: 18, y: 72 }
const INITIAL_TARGET = { x: 79, y: 29 }

const EASING_FUNCTIONS = {
  linear: (progress: number) => progress,
  easeOut: (progress: number) => 1 - (1 - progress) ** 3,
  spring: (progress: number) =>
    progress === 1 ? 1 : 1 - Math.cos(progress * 11) * Math.exp(-progress * 7),
}

const target = ref({ ...INITIAL_TARGET })

const duration = shallowRef(1.8)
const easing = shallowRef<keyof typeof EASING_FUNCTIONS>('easeOut')

const [shouldLoop] = useToggle(true)
const progress = shallowRef(0)

const reducedMotion = usePreferredReducedMotion()

const [isPlaying, setIsPlaying] = useToggle(reducedMotion.value !== 'reduce')

const hostRef = useTemplateRef('hostRef')
const stageRef = useTemplateRef('stageRef')

const timing = shallowRef<FolderApi>()
const placement = shallowRef<FolderApi>()
const { width } = useElementSize(stageRef)

function replay() {
  progress.value = 0
  setIsPlaying(true)
}

function togglePlayback() {
  if (!isPlaying.value && progress.value === 1) {
    replay()
  } else {
    setIsPlaying()
  }
}

useTweakpane(hostRef, {
  title: 'Motion',
  configure(pane) {
    timing.value = pane.addFolder({ title: 'Timing' })
    placement.value = pane.addFolder({ title: 'Placement' })
    pane.addButton({ title: 'Replay' }).on('click', replay)
  },
})

useTweakBinding(timing, duration, {
  label: 'Duration (s)',
  min: 0.3,
  max: 5,
  step: 0.1,
})
useTweakBinding(timing, easing, {
  label: 'Easing',
  options: { Linear: 'linear', 'Ease out': 'easeOut', Spring: 'spring' },
})
useTweakBinding(timing, shouldLoop, { label: 'Loop' })
useTweakBinding(placement, target, {
  label: 'Target',
  x: { min: 12, max: 86, step: 1 },
  y: { min: 14, max: 86, step: 1 },
  yInverted: true,
})

const { pause, resume } = useRafFn(
  ({ delta }) => {
    const next = progress.value + Math.min(delta, 50) / (duration.value * 1000)
    if (next >= 1 && !shouldLoop.value) {
      progress.value = 1
      setIsPlaying(false)
    } else {
      progress.value = next % 1
    }
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

function positionAt(amount: number) {
  return {
    left: `${ORIGIN.x + (target.value.x - ORIGIN.x) * amount}%`,
    top: `${ORIGIN.y + (target.value.y - ORIGIN.y) * amount}%`,
  }
}

const path = computed(() =>
  Array.from({ length: 15 }, (_, index) => positionAt((index + 1) / 16)),
)
const marker = computed(() =>
  positionAt(EASING_FUNCTIONS[easing.value](progress.value)),
)
</script>

<template>
  <ExampleFrame>
    <ExampleStage
      ref="stageRef"
      class="bg-center [background-image:linear-gradient(90deg,var(--chart-grid)_1px,transparent_1px),linear-gradient(var(--chart-grid)_1px,transparent_1px)] [background-size:24px_24px]"
      aria-label="Motion path"
      role="img"
    >
      <span
        v-for="(point, index) in path"
        :key="index"
        class="absolute size-[3px] translate-[-50%] rounded-full bg-chart-axis"
        :style="point"
      ></span>
      <span
        v-for="(label, index) in ['Start', 'Target']"
        :key="label"
        class="absolute size-[36px] translate-[-50%] grid items-start justify-items-center rounded-full border border-chart-axis border-dashed pt-[39px] font-readout text-[11px] text-muted leading-none"
        :style="positionAt(index)"
        >{{ label }}</span
      >
      <span
        class="absolute size-[23px] translate-[-50%] rounded-full border-2 border-surface bg-chart-trace"
        :style="marker"
      ></span>
      <progress
        class="absolute inset-x-[12px] bottom-[10px] h-[4px] w-[calc(100%_-_24px)] accent-chart-trace"
        aria-label="Animation progress"
        max="1"
        :value="progress"
      ></progress>
    </ExampleStage>
    <template #stats>
      <div>
        <dt>Duration</dt>
        <dd>{{ duration.toFixed(1) }} s</dd>
      </div>
      <div>
        <dt>Target</dt>
        <dd>{{ target.x }}%, {{ target.y }}%</dd>
      </div>
    </template>
    <template #actions>
      <ToolbarButton
        :icon="isPlaying ? 'i-lucide:pause' : 'i-lucide:play'"
        @click="togglePlayback"
      >
        {{ isPlaying ? 'Pause' : 'Play' }}
      </ToolbarButton>
      <ToolbarButton
        icon="i-lucide:rotate-ccw"
        @click="replay"
        >Replay</ToolbarButton
      >
    </template>
    <template #controls>
      <div
        ref="hostRef"
        class="rounded-[6px] border border-stroke"
        aria-label="Motion controls"
        role="group"
      ></div>
    </template>
  </ExampleFrame>
</template>
