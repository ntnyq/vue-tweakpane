<script setup lang="ts">
import type { VNode } from 'vue'

defineProps<{
  actionsLabel?: string
  announceStats?: boolean
}>()

defineSlots<{
  default?: () => VNode
  stats?: () => VNode
  actions?: () => VNode
  controls?: () => VNode
}>()
</script>

<template>
  <div
    class="grid grid-cols-[minmax(0,1fr)_minmax(242px,290px)] items-start gap-[14px] max-[760px]:(grid-cols-1 gap-[10px])"
  >
    <div class="min-w-0">
      <slot />
      <div
        class="mt-[8px] min-h-[42px] flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[6px] rounded-panel border border-stroke bg-panel px-[8px] py-[5px]"
      >
        <dl
          class="flex flex-wrap items-center gap-x-[10px] gap-y-[5px] [&>div]:(flex items-baseline gap-x-[8px] gap-y-[4px] text-[11px] text-muted) [&_dd]:(font-readout text-[11px] text-ink leading-[1.5] tabular-nums)"
          :aria-live="announceStats ? 'polite' : undefined"
        >
          <slot name="stats" />
        </dl>
        <div
          class="flex flex-wrap items-center gap-[5px]"
          :role="actionsLabel ? 'group' : undefined"
          :aria-label="actionsLabel"
        >
          <slot name="actions" />
        </div>
      </div>
    </div>
    <div class="min-w-0">
      <slot name="controls" />
    </div>
  </div>
</template>
