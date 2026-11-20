<script setup lang="ts">
import { onClickOutside, useToggle } from '@vueuse/core'
import { nextTick, useId, useTemplateRef } from 'vue'
import { EXAMPLES } from '../examples'
import type { ExampleId } from '../examples'

const selected = defineModel<ExampleId>({ required: true })

const menuId = useId()

const dropdownRef = useTemplateRef('dropdownRef')
const triggerRef = useTemplateRef('triggerRef')
const menuRef = useTemplateRef('menuRef')

const [isOpen, setIsOpen] = useToggle(false)

onClickOutside(dropdownRef, () => closeMenu())

function closeMenu(restoreFocus = false) {
  setIsOpen(false)
  if (restoreFocus) {
    triggerRef.value?.focus()
  }
}

async function openMenu(focus: 'selected' | 'first' | 'last' = 'selected') {
  setIsOpen(true)
  await nextTick()
  if (!isOpen.value) {
    return
  }
  const items = menuRef.value?.querySelectorAll('button')
  const item =
    focus === 'selected'
      ? menuRef.value?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      : items?.[focus === 'first' ? 0 : items.length - 1]
  item?.focus()
}

function selectExample(id: ExampleId) {
  selected.value = id
  closeMenu(true)
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.key === 'Tab') {
    if (event.key === 'Escape') {
      event.preventDefault()
    }
    closeMenu(true)
    return
  }

  const items = [...(menuRef.value?.querySelectorAll('button') ?? [])]
  const current = items.findIndex(item => item === event.target)
  let next: number
  switch (event.key) {
    case 'Home':
      next = 0
      break
    case 'End':
      next = items.length - 1
      break
    case 'ArrowDown':
      next = (current + 1) % items.length
      break
    case 'ArrowUp':
      next = (current + items.length - 1) % items.length
      break
    default:
      return
  }

  event.preventDefault()
  items[next]?.focus()
}
</script>

<template>
  <div
    ref="dropdownRef"
    class="relative min-w-0"
  >
    <button
      ref="triggerRef"
      type="button"
      class="min-h-[28px] w-[174px] max-w-full inline-flex items-center gap-[6px] rounded-panel border border-stroke bg-panel px-[8px] text-[12px] text-ink font-medium aria-expanded:(bg-accent-fill text-accent) hover:bg-control-hover"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-controls="menuId"
      :aria-label="`Examples: ${EXAMPLES[selected].label}`"
      @click="isOpen ? closeMenu() : openMenu()"
      @keydown.down.prevent="openMenu('first')"
      @keydown.up.prevent="openMenu('last')"
    >
      <span
        class="flex-none text-[14px]"
        :class="EXAMPLES[selected].icon"
        aria-hidden="true"
      ></span>
      <span class="truncate">{{ EXAMPLES[selected].label }}</span>
      <span
        class="i-lucide:chevron-down ms-auto flex-none text-[14px]"
        aria-hidden="true"
      ></span>
    </button>

    <div
      v-show="isOpen"
      :id="menuId"
      ref="menuRef"
      class="absolute start-0 top-[calc(100%_+_5px)] z-5 w-[190px] rounded-panel border border-stroke bg-panel p-[3px] shadow-[0_6px_14px_#0002]"
      role="menu"
      aria-label="Examples"
      @keydown="onMenuKeydown"
    >
      <button
        v-for="(example, id) in EXAMPLES"
        :key="id"
        type="button"
        class="min-h-[28px] w-full flex items-center gap-[8px] rounded-[3px] px-[7px] text-start aria-checked:(bg-accent-fill text-accent) hover:bg-control-hover focus-visible:(bg-control-hover outline-offset-[-2px])"
        role="menuitemradio"
        tabindex="-1"
        :aria-checked="id === selected"
        @click="selectExample(id)"
      >
        <span
          class="flex-none text-[14px]"
          :class="example.icon"
          aria-hidden="true"
        ></span>
        <span>{{ example.label }}</span>
        <span
          v-if="id === selected"
          class="i-lucide:check ms-auto flex-none text-[14px]"
          aria-hidden="true"
        ></span>
      </button>
    </div>
  </div>
</template>
