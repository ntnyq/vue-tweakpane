<script setup lang="ts">
import { expectTypeOf } from 'vitest'
import { shallowRef } from 'vue'
import {
  TweakBinding,
  TweakBlade,
  TweakButton,
  TweakFolder,
  TweakPane,
} from '../src/components'

const quality = shallowRef<'low' | 'high'>('low')
const position = shallowRef({ x: 0, y: 0 })
const date = shallowRef(new Date())
</script>

<template>
  <TweakPane>
    <TweakBinding
      v-model="quality"
      @update:model-value="
        value => expectTypeOf(value).toEqualTypeOf<'low' | 'high'>()
      "
    />
    <TweakBinding
      v-model="position"
      @update:model-value="
        value => expectTypeOf(value).toEqualTypeOf<{ x: number; y: number }>()
      "
    />
    <TweakFolder
      title="Example"
      :expanded="false"
    >
      <TweakButton
        title="Reset"
        @click="quality = 'low'"
      />
      <TweakBlade
        :create="(rack, index) => rack.addBlade({ view: 'separator', index })"
      />
    </TweakFolder>

    <!-- @vue-expect-error -->
    <TweakBinding v-model="date" />

    <!-- @vue-expect-error -->
    <TweakBinding
      v-model="quality"
      :params="{ readonly: true }"
    />
  </TweakPane>
</template>
