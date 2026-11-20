import {
  defineConfig,
  presetIcons,
  presetWind4,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  content: {
    pipeline: {
      exclude: [/[?&]raw(?:&|$)/],
      include: [/\.(?:vue|html)($|\?)/, /src\/examples\.ts$/],
    },
  },
  presets: [presetWind4(), presetIcons()],
  theme: {
    colors: {
      accent: 'var(--accent)',
      'accent-fill': 'var(--accent-fill)',
      'chart-axis': 'var(--chart-axis)',
      'chart-trace': 'var(--chart-trace)',
      'control-hover': 'var(--hover)',
      ink: 'var(--ink)',
      muted: 'var(--muted)',
      panel: 'var(--panel)',
      stroke: 'var(--border)',
      surface: 'var(--surface)',
    },
    font: {
      readout: 'var(--mono)',
    },
    radius: {
      panel: 'var(--radius)',
    },
  },
  transformers: [transformerVariantGroup()],
})
