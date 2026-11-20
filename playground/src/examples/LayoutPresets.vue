<script setup lang="ts">
import type { TabPageApi } from 'tweakpane'
import { computed, ref, shallowRef, toRefs, useTemplateRef } from 'vue'
import { useTweakBinding, useTweakpane } from 'vue-tweakpane'
import ExampleFrame from '../components/ExampleFrame.vue'
import ExampleStage from '../components/ExampleStage.vue'
import ToolbarButton from '../components/ToolbarButton.vue'

const PRESETS = {
  Compact: { columns: 3, gap: 8, width: 92, corners: 3, showBorders: true },
  Editorial: { columns: 2, gap: 16, width: 81, corners: 3, showBorders: false },
  Gallery: { columns: 4, gap: 12, width: 96, corners: 10, showBorders: true },
}

type Preset = keyof typeof PRESETS

const settings = ref({ ...PRESETS.Compact })
const { columns, width, corners, showBorders } = toRefs(settings.value)

const hostRef = useTemplateRef('hostRef')

const layoutPage = shallowRef<TabPageApi>()
const surfacePage = shallowRef<TabPageApi>()

const spacing = computed({
  get: () => settings.value.gap / 8,
  set: units => {
    settings.value.gap = Math.round(units * 8)
  },
})
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))`,
  width: `${width.value}%`,
  gap: `${settings.value.gap}px`,
  '--tile-radius': `${corners.value}px`,
}))

function applyPreset(preset: Preset) {
  Object.assign(settings.value, PRESETS[preset])
}

function isPresetActive(preset: Preset) {
  const config = PRESETS[preset]
  const current = settings.value
  return (
    current.columns === config.columns &&
    current.gap === config.gap &&
    current.width === config.width &&
    current.corners === config.corners &&
    current.showBorders === config.showBorders
  )
}

useTweakpane(hostRef, {
  title: 'Layout',
  configure(pane) {
    const tabs = pane.addTab({
      pages: [{ title: 'Grid' }, { title: 'Surface' }],
    })
    const [gridTab, surfaceTab] = tabs.pages
    layoutPage.value = gridTab
    surfacePage.value = surfaceTab
    pane
      .addButton({ title: 'Reset layout' })
      .on('click', () => applyPreset('Compact'))
  },
})

useTweakBinding(layoutPage, columns, {
  label: 'Columns',
  min: 1,
  max: 4,
  step: 1,
})
useTweakBinding(layoutPage, spacing, {
  label: 'Gap (×8 px)',
  min: 0.5,
  max: 3,
  step: 0.125,
})
useTweakBinding(layoutPage, width, {
  label: 'Width (%)',
  min: 50,
  max: 100,
  step: 1,
})
useTweakBinding(surfacePage, corners, {
  label: 'Radius',
  min: 0,
  max: 24,
  step: 1,
})
useTweakBinding(surfacePage, showBorders, { label: 'Outlines' })
</script>

<template>
  <ExampleFrame actions-label="Layout presets">
    <ExampleStage
      class="[background-image:radial-gradient(var(--chart-axis)_0.6px,transparent_0.6px)] [background-size:16px_16px]"
    >
      <div
        class="absolute inset-0 grid justify-items-center overflow-auto p-[14px] [align-items:safe_center]"
      >
        <ol
          class="grid"
          :style="gridStyle"
          aria-label="Grid layout preview"
        >
          <li
            v-for="tile in 8"
            :key="tile"
            class="min-h-[clamp(60px,9vw,98px)] min-w-0 grid content-start gap-[5px] rounded-[var(--tile-radius)] border bg-panel p-[clamp(5px,1.25vw,14px)]"
            :class="showBorders ? 'border-stroke' : 'border-transparent'"
          >
            <span
              class="mb-[3px] w-fit rounded-[3px] bg-accent-fill px-[5px] font-readout text-[11px] text-accent leading-[17px]"
              >{{ tile }}</span
            >
            <span class="h-[4px] w-[73%] rounded-[2px] bg-stroke"></span>
            <span class="h-[4px] w-[51%] rounded-[2px] bg-stroke"></span>
          </li>
        </ol>
      </div>
    </ExampleStage>
    <template #stats>
      <div>
        <dt>Columns</dt>
        <dd>{{ columns }}</dd>
      </div>
      <div>
        <dt>Gap</dt>
        <dd>{{ settings.gap }} px</dd>
      </div>
      <div>
        <dt>Width</dt>
        <dd>{{ width }}%</dd>
      </div>
    </template>
    <template #actions>
      <ToolbarButton
        v-for="(_, preset) in PRESETS"
        :key="preset"
        :aria-pressed="isPresetActive(preset)"
        @click="applyPreset(preset)"
      >
        {{ preset }}
      </ToolbarButton>
    </template>
    <template #controls>
      <div
        ref="hostRef"
        class="rounded-[6px] border border-stroke"
        aria-label="Layout controls"
        role="group"
      ></div>
    </template>
  </ExampleFrame>
</template>
