<script setup lang="ts">
import { useToggle } from '@vueuse/core'
import type { TabPageApi } from 'tweakpane'
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import { useTweakBinding, useTweakpane } from 'vue-tweakpane'
import ExampleFrame from '../components/ExampleFrame.vue'
import ExampleStage from '../components/ExampleStage.vue'
import ToolbarButton from '../components/ToolbarButton.vue'

interface Color {
  r: number
  g: number
  b: number
}

const INITIAL_INK = { r: 238, g: 160, b: 119 }
const INITIAL_PAPER = { r: 34, g: 47, b: 71 }

const ink = ref({ ...INITIAL_INK })
const paper = ref({ ...INITIAL_PAPER })

const strength = shallowRef(72)
const [shouldShowSwatches, setShouldShowSwatches] = useToggle(true)

const hostRef = useTemplateRef('hostRef')

const colorsPage = shallowRef<TabPageApi>()
const mixPage = shallowRef<TabPageApi>()

function swapColors() {
  const previousInk = ink.value
  ink.value = paper.value
  paper.value = previousInk
}

function reset() {
  ink.value = { ...INITIAL_INK }
  paper.value = { ...INITIAL_PAPER }
  strength.value = 72
  setShouldShowSwatches(true)
}

useTweakpane(hostRef, {
  title: 'Palette',
  configure(pane) {
    const tabs = pane.addTab({ pages: [{ title: 'Colors' }, { title: 'Mix' }] })
    const [colorsTab, mixTab] = tabs.pages
    colorsPage.value = colorsTab
    mixPage.value = mixTab
    pane.addButton({ title: 'Swap colors' }).on('click', swapColors)
    pane.addButton({ title: 'Reset palette' }).on('click', reset)
  },
})

useTweakBinding(colorsPage, ink, { label: 'Ink' })
useTweakBinding(colorsPage, paper, { label: 'Paper' })
useTweakBinding(mixPage, strength, {
  label: 'Ink opacity',
  min: 0,
  max: 100,
  step: 1,
})
useTweakBinding(mixPage, shouldShowSwatches, { label: 'Show swatches' })

const mixed = computed(() => {
  const alpha = strength.value / 100
  const inkColor = ink.value
  const paperColor = paper.value
  return {
    r: Math.round(inkColor.r * alpha + paperColor.r * (1 - alpha)),
    g: Math.round(inkColor.g * alpha + paperColor.g * (1 - alpha)),
    b: Math.round(inkColor.b * alpha + paperColor.b * (1 - alpha)),
  }
})

function toHex({ r, g, b }: Color) {
  return `#${[r, g, b]
    .map(channel => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

function linearize(channel: number) {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance({ r, g, b }: Color) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

const contrast = computed(() => {
  const inkLight = luminance(mixed.value)
  const paperLight = luminance(paper.value)
  return (
    (Math.max(inkLight, paperLight) + 0.05) /
    (Math.min(inkLight, paperLight) + 0.05)
  )
})
</script>

<template>
  <ExampleFrame>
    <ExampleStage class="grid grid-rows-[1fr_auto]">
      <div
        class="min-h-0 grid place-items-center pe-[0.08em] text-[clamp(5rem,17vw,15rem)] font-semibold leading-[0.95] tracking-[-0.08em] [font-family:Georgia,serif]"
        :style="{ backgroundColor: toHex(paper), color: toHex(mixed) }"
        aria-label="Ink blended over paper"
        role="img"
      >
        Aa
      </div>
      <div
        v-if="shouldShowSwatches"
        class="grid grid-cols-2"
      >
        <div
          v-for="(color, label) in { Ink: ink, Paper: paper }"
          :key="label"
          class="flex flex-wrap items-center gap-x-[7px] gap-y-[5px] border-t border-stroke px-[10px] py-[8px] last:border-s"
        >
          <span
            class="size-[14px] rounded-[3px] border border-stroke"
            :style="{ backgroundColor: toHex(color) }"
          ></span>
          <span>{{ label }}</span>
          <code class="ms-auto text-[11px] text-muted">{{ toHex(color) }}</code>
        </div>
      </div>
    </ExampleStage>
    <template #stats>
      <div>
        <dt>Mix</dt>
        <dd>{{ toHex(mixed) }}</dd>
      </div>
      <div>
        <dt>Opacity</dt>
        <dd>{{ strength }}%</dd>
      </div>
      <div>
        <dt>Contrast</dt>
        <dd>{{ contrast.toFixed(2) }}:1</dd>
      </div>
    </template>
    <template #actions>
      <ToolbarButton
        icon="i-lucide:arrow-left-right"
        @click="swapColors"
        >Swap</ToolbarButton
      >
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
        aria-label="Palette controls"
        role="group"
      ></div>
    </template>
  </ExampleFrame>
</template>
