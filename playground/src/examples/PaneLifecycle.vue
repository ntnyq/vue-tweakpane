<script setup lang="ts">
import * as Essentials from '@tweakpane/plugin-essentials'
import { useToggle } from '@vueuse/core'
import type { FolderApi } from 'tweakpane'
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import { useTweakBinding, useTweakpane } from 'vue-tweakpane'
import ExampleFrame from '../components/ExampleFrame.vue'
import ExampleStage from '../components/ExampleStage.vue'
import ToolbarButton from '../components/ToolbarButton.vue'

const hostRef = useTemplateRef('hostRef')
const hostKey = shallowRef(0)
const [shouldShowHost, setShouldShowHost] = useToggle(true)
const [shouldBindPosition] = useToggle(true)
const position = ref({ x: 0, y: 0 })
const motion = shallowRef<FolderApi>()
const created = shallowRef(0)
const disposed = shallowRef(0)

const pane = useTweakpane(hostRef, {
  title: 'Lifecycle',
  configure(instance) {
    created.value++
    instance.registerPlugin(Essentials)
    const graph = instance.addBlade({ view: 'fpsgraph', label: 'FPS' })

    let frame = 0
    if (graph instanceof Essentials.FpsGraphBladeApi) {
      const sample = () => {
        graph.end()
        graph.begin()
        frame = requestAnimationFrame(sample)
      }
      graph.begin()
      frame = requestAnimationFrame(sample)
    }

    motion.value = instance.addFolder({ title: 'Motion' })
    instance.addButton({ title: 'Move X by 1' }).on('click', movePoint)

    return () => {
      cancelAnimationFrame(frame)
      motion.value = undefined
      disposed.value++
    }
  },
})

const point = useTweakBinding(
  () => (shouldBindPosition.value ? motion.value : null),
  position,
  {
    label: 'Position',
    x: { step: 1 },
    y: { step: 1 },
  },
)

const steps = computed(() => [
  {
    label: 'Host',
    icon: 'i-lucide:square-dashed',
    status: hostRef.value ? 'Mounted' : 'Absent',
    active: Boolean(hostRef.value),
  },
  {
    label: 'Pane',
    icon: 'i-lucide:sliders-horizontal',
    status: pane.value ? 'Active' : 'Disposed',
    active: Boolean(pane.value),
  },
  {
    label: 'Position binding',
    icon: 'i-lucide:link-2',
    status: point.value ? 'Connected' : 'Detached',
    active: Boolean(point.value),
  },
])

function rebuild() {
  setShouldShowHost(true)
  hostKey.value++
}

function movePoint() {
  position.value.x++
}
</script>

<template>
  <ExampleFrame announce-stats>
    <ExampleStage
      class="grid place-items-center [background-image:radial-gradient(var(--chart-axis)_0.6px,transparent_0.6px)] [background-size:20px_20px]"
    >
      <ol
        class="w-[min(87%,560px)] grid grid-cols-3 gap-[16px] max-[480px]:(w-[92%] gap-[7px])"
        aria-label="Pane lifecycle"
      >
        <li
          v-for="step in steps"
          :key="step.label"
          class="relative min-h-[96px] grid content-center gap-[12px] rounded-panel border bg-panel p-[12px] text-muted [&:not(:last-child)]:after:(absolute top-1/2 end-[-17px] w-[16px] border-t border-chart-axis border-dashed content-empty) max-[480px]:(p-[7px] [&:not(:last-child)]:after:(end-[-8px] w-[7px]))"
          :class="step.active ? 'border-accent' : 'border-stroke'"
        >
          <span
            class="text-[17px]"
            :class="[step.icon, { 'text-accent': step.active }]"
            aria-hidden="true"
          ></span>
          <div>
            <div class="text-ink font-semibold">{{ step.label }}</div>
            <div class="mt-[3px] font-readout text-[11px] leading-[1.4]">
              {{ step.status }}
            </div>
          </div>
        </li>
      </ol>
    </ExampleStage>
    <template #stats>
      <div>
        <dt>Created</dt>
        <dd>{{ created }}</dd>
      </div>
      <div>
        <dt>Disposed</dt>
        <dd>{{ disposed }}</dd>
      </div>
      <div>
        <dt>Position</dt>
        <dd>{{ position.x }}, {{ position.y }}</dd>
      </div>
    </template>
    <template #actions>
      <ToolbarButton @click="setShouldShowHost()">
        {{ shouldShowHost ? 'Unmount host' : 'Mount host' }}
      </ToolbarButton>
      <ToolbarButton @click="rebuild">Rebuild</ToolbarButton>
      <ToolbarButton
        :disabled="!pane"
        @click="pane?.dispose()"
        >Dispose pane</ToolbarButton
      >
    </template>
    <template #controls>
      <div
        v-if="shouldShowHost"
        :key="hostKey"
        ref="hostRef"
        class="rounded-[6px] border border-stroke"
        aria-label="Lifecycle controls"
        role="group"
      ></div>
      <p
        v-if="!pane"
        class="mt-[8px] text-[12px] text-muted"
      >
        {{
          shouldShowHost
            ? 'Host mounted. Rebuild to create a new pane.'
            : 'Mount the host to create a pane.'
        }}
      </p>
      <div
        class="mt-[8px] flex flex-wrap items-center justify-between gap-[6px]"
      >
        <label class="flex items-center gap-[6px] text-[12px] text-muted">
          <input
            v-model="shouldBindPosition"
            class="accent-accent"
            type="checkbox"
          />
          Bind position
        </label>
        <ToolbarButton @click="movePoint">Move X by 1 in Vue</ToolbarButton>
      </div>
    </template>
  </ExampleFrame>
</template>
