<script setup lang="ts">
import { useClipboard, useToggle } from '@vueuse/core'
import { onMounted, shallowRef } from 'vue'
import ToolbarButton from './ToolbarButton.vue'

interface SourcePreview {
  source: string
  html: string
}

const { filename, loadSource } = defineProps<{
  filename: string
  loadSource: () => Promise<SourcePreview>
}>()

const {
  copy,
  copied: hasCopied,
  copyPending: isCopyPending,
} = useClipboard({ legacy: true })

const [hasLoadFailed, setHasLoadFailed] = useToggle(false)
const [hasCopyFailed, setHasCopyFailed] = useToggle(false)

const preview = shallowRef<SourcePreview>()

async function load() {
  setHasLoadFailed(false)
  try {
    preview.value = await loadSource()
  } catch {
    setHasLoadFailed(true)
  }
}

async function copySource() {
  if (!preview.value) {
    return
  }
  setHasCopyFailed(false)
  try {
    await copy(preview.value.source)
  } catch {
    setHasCopyFailed(true)
  }
}

onMounted(load)
</script>

<template>
  <div class="overflow-hidden rounded-panel border border-stroke bg-surface">
    <div
      class="min-h-[37px] flex items-center justify-between gap-2 border-b border-stroke bg-panel px-[8px] py-[4px] text-[12px] text-muted"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="i-lucide:file-code flex-none text-[14px]"
          aria-hidden="true"
        ></span>
        <span class="truncate font-mono">{{ filename }}</span>
      </div>
      <ToolbarButton
        class="shrink-0"
        :icon="hasCopied ? 'i-lucide:check' : 'i-lucide:copy'"
        :disabled="!preview || (isCopyPending && !hasCopyFailed)"
        @click="copySource"
      >
        {{ hasCopied ? 'Copied' : 'Copy code' }}
      </ToolbarButton>
    </div>

    <p
      class="sr-only"
      role="status"
    >
      {{ hasCopied ? 'Source copied to clipboard' : '' }}
    </p>
    <p
      v-if="hasCopyFailed"
      class="px-[12px] py-[10px] text-muted"
      role="status"
    >
      Clipboard access failed. Select the code to copy it manually.
    </p>

    <!-- HTML comes from Shiki at build time and only contains repository source. -->
    <div
      v-if="preview"
      class="max-h-[min(75vh,820px)] overflow-auto font-readout text-[12px] leading-[1.65] focus-visible:outline-offset-[-2px] [&_pre]:(w-max min-w-full py-[8px] pe-[16px] [counter-reset:line]) [&_*]:[color:var(--shiki-light)] dark:[&_*]:[color:var(--shiki-dark)] [&_.line]:before:(inline-block w-[3.5rem] me-[1rem] pe-[0.6rem] select-none border-e border-stroke bg-panel text-end text-muted [content:counter(line)] [counter-increment:line])"
      tabindex="0"
      role="region"
      :aria-label="filename"
      v-html="preview.html"
    ></div>
    <div
      v-else-if="hasLoadFailed"
      class="flex items-center gap-2 px-[12px] py-[10px] text-muted"
    >
      <p role="status">Couldn’t load the source.</p>
      <ToolbarButton @click="load"> Try again </ToolbarButton>
    </div>
    <p
      v-else
      class="px-[12px] py-[10px] text-muted"
      role="status"
    >
      Loading source…
    </p>
  </div>
</template>
