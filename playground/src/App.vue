<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { computed, shallowRef } from 'vue'
import ExampleSelect from './components/ExampleSelect.vue'
import SourceViewer from './components/SourceViewer.vue'
import ToolbarButton from './components/ToolbarButton.vue'
import { EXAMPLES } from './examples'
import type { ExampleId } from './examples'

const isDark = useDark({
  storageKey: 'vue-tweakpane:theme',
})
const setIsDark = useToggle(isDark)

const selected = shallowRef<ExampleId>('signal')
const view = shallowRef<'preview' | 'source'>('preview')
const example = computed(() => EXAMPLES[selected.value])

const themeAction = computed(() =>
  isDark.value ? 'Switch to light mode' : 'Switch to dark mode',
)
</script>

<template>
  <header class="border-b border-stroke bg-panel">
    <div
      class="mx-auto min-h-[48px] max-w-[1572px] flex items-center justify-between gap-3 px-[clamp(12px,2.5vw,36px)]"
    >
      <h1
        class="min-w-0 flex items-center gap-2.5 text-[15px] tracking-[-0.015em]"
      >
        <span
          class="i-lucide:sliders-horizontal flex-none text-[19px] text-accent"
          aria-hidden="true"
        ></span>
        <span class="font-semibold">vue-tweakpane</span>
        <span
          class="border-s border-stroke ps-[10px] text-[13px] text-muted tracking-normal max-[350px]:hidden"
          >Playground</span
        >
      </h1>
      <div class="flex shrink-0 items-center gap-1.5">
        <ToolbarButton
          variant="icon"
          :icon="isDark ? 'i-lucide:sun' : 'i-lucide:moon'"
          :aria-label="themeAction"
          :tooltip="themeAction"
          @click="setIsDark()"
        />
        <ToolbarButton
          variant="icon"
          icon="i-lucide:github"
          href="https://github.com/ntnyq/vue-tweakpane"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository (opens in a new tab)"
          tooltip="GitHub repository"
        />
      </div>
    </div>
  </header>

  <main
    class="mx-auto max-w-[1572px] px-[clamp(12px,2.5vw,36px)] pb-[24px] pt-[12px]"
  >
    <div
      class="mb-[14px] flex items-center justify-between gap-2 rounded-panel border border-stroke bg-panel p-[5px]"
    >
      <ExampleSelect v-model="selected" />

      <div
        class="flex flex-none items-center rounded-panel border border-stroke"
        role="group"
        aria-label="Example view"
      >
        <ToolbarButton
          variant="segment"
          icon="i-lucide:eye"
          :aria-pressed="view === 'preview'"
          aria-label="View preview"
          tooltip="View preview"
          @click="view = 'preview'"
        />
        <ToolbarButton
          variant="segment"
          icon="i-lucide:code-xml"
          class="border-s border-stroke"
          :aria-pressed="view === 'source'"
          aria-label="View source"
          tooltip="View source"
          @click="view = 'source'"
        />
      </div>
    </div>

    <section :aria-label="example.label">
      <component
        :is="example.component"
        v-show="view === 'preview'"
        :key="selected"
      />
      <SourceViewer
        v-if="view === 'source'"
        :key="selected"
        :filename="example.filename"
        :load-source="example.loadSource"
      />
    </section>
  </main>
</template>
