<script setup lang="ts">
interface Props {
  /**
   * Renders the control as a link to this destination.
   */
  href?: string
  /**
   * The utility class for the button icon.
   */
  icon?: string
  /**
   * The label shown on hover or keyboard focus.
   */
  tooltip?: string
  /**
   * Controls the shape of icon buttons and segmented controls.
   */
  variant?: 'icon' | 'segment'
}

defineProps<Props>()
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :type="href ? undefined : 'button'"
    class="group relative inline-flex items-center justify-center gap-[6px] whitespace-nowrap bg-panel text-[12px] font-medium [&:hover:not(:disabled)]:bg-control-hover disabled:opacity-[0.55] aria-pressed:(bg-accent-fill text-accent)"
    :class="
      variant === 'segment'
        ? 'min-h-[26px] w-[30px] rounded-[4px] text-muted'
        : [
            'min-h-[28px] rounded-panel border border-stroke text-ink',
            variant === 'icon' ? 'w-[30px]' : 'px-[8px]',
          ]
    "
  >
    <span
      v-if="icon"
      class="flex-none text-[14px]"
      :class="icon"
      aria-hidden="true"
    ></span>
    <slot />
    <span
      v-if="tooltip"
      class="pointer-events-none absolute end-0 top-[calc(100%_+_7px)] z-4 hidden rounded-panel border border-stroke bg-surface px-[6px] py-[4px] text-ink group-hover:block group-focus-visible:block"
      aria-hidden="true"
      >{{ tooltip }}</span
    >
  </component>
</template>
