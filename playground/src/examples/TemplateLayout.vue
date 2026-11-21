<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import {
  TweakBinding,
  TweakBlade,
  TweakButton,
  TweakFolder,
  TweakPane,
} from 'vue-tweakpane/components'
import ExampleFrame from '../components/ExampleFrame.vue'
import ExampleStage from '../components/ExampleStage.vue'
import ToolbarButton from '../components/ToolbarButton.vue'

const showPosition = shallowRef(false)
const showDetails = shallowRef(true)

const quality = shallowRef<'low' | 'high'>('low')
const position = ref({ x: 0, y: 0 })

const channels = ref([
  { id: 'red', label: 'Red', level: 0.7, color: '#e36565' },
  { id: 'green', label: 'Green', level: 0.45, color: '#51af80' },
  { id: 'blue', label: 'Blue', level: 0.85, color: '#6294ed' },
])
</script>

<template>
  <ExampleFrame>
    <ExampleStage class="grid place-items-center">
      <ul
        class="w-[min(84%,460px)] grid gap-4"
        aria-label="Channel levels"
      >
        <li
          v-for="channel in channels"
          :key="channel.id"
          class="grid grid-cols-[48px_1fr_40px] items-center gap-3 text-sm"
        >
          <span>{{ channel.label }}</span>
          <div
            class="h-2 overflow-hidden rounded-full bg-stroke"
            aria-hidden="true"
          >
            <div
              class="h-full rounded-full"
              :style="{
                width: `${channel.level * 100}%`,
                backgroundColor: channel.color,
              }"
            ></div>
          </div>
          <span class="text-end font-readout">{{
            channel.level.toFixed(2)
          }}</span>
        </li>
      </ul>
    </ExampleStage>

    <template #stats>
      <div>
        <dt>Quality</dt>
        <dd>{{ quality }}</dd>
      </div>
      <div>
        <dt>Position</dt>
        <dd>{{ position.x }}, {{ position.y }}</dd>
      </div>
    </template>

    <template #actions>
      <ToolbarButton @click="showPosition = !showPosition">
        {{ showPosition ? 'Remove position' : 'Insert position' }}
      </ToolbarButton>
      <ToolbarButton @click="channels.reverse()">
        Reverse channels
      </ToolbarButton>
      <ToolbarButton @click="showDetails = !showDetails">
        {{ showDetails ? 'Remove details' : 'Restore details' }}
      </ToolbarButton>
    </template>

    <template #controls>
      <TweakPane
        title="Template layout"
        class="rounded-[6px] border border-stroke"
      >
        <TweakBinding
          v-model="quality"
          :params="{ label: 'Quality', options: { Low: 'low', High: 'high' } }"
        />
        <TweakBinding
          v-if="showPosition"
          v-model="position"
          :params="{ label: 'Position' }"
        />
        <TweakButton
          title="Reset quality"
          @click="quality = 'low'"
        />

        <TweakFolder title="Channels">
          <TweakBinding
            v-for="channel in channels"
            :key="channel.id"
            v-model="channel.level"
            :params="{ label: channel.label, min: 0, max: 1, step: 0.01 }"
          />

          <TweakFolder
            v-if="showDetails"
            title="Details"
          >
            <TweakBlade
              :create="
                (rack, index) => rack.addBlade({ view: 'separator', index })
              "
            />
            <TweakBinding
              v-model="position"
              :params="{ label: 'Shared position' }"
            />
          </TweakFolder>
        </TweakFolder>
      </TweakPane>
    </template>
  </ExampleFrame>
</template>
