import { defineConfig } from 'tsdown'
import vue from 'unplugin-vue/rolldown'

export default defineConfig({
  clean: true,
  deps: {
    onlyBundle: ['@ntnyq/utils'],
  },
  dts: {
    // Keep generated component types compatible with the Vue peer minimum.
    compilerOptions: {
      paths: {
        vue: ['./node_modules/vue-runtime-types/dist/runtime-dom.d.ts'],
      },
    },
    tsc: {
      vue: true,
    },
  },
  entry: {
    components: 'src/components/index.ts',
    index: 'src/index.ts',
  },
  platform: 'neutral',
  plugins: [
    vue({
      isProduction: true,
    }),
  ],
})
