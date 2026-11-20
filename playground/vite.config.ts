import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHighlighterCoreSync } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import vueGrammar from '@shikijs/langs/vue'
import githubDarkDefault from '@shikijs/themes/github-dark-default'
import githubLight from '@shikijs/themes/github-light'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

function sourcePreview(): Plugin {
  let highlighter: ReturnType<typeof createHighlighterCoreSync> | undefined

  return {
    enforce: 'pre',
    async load(id) {
      const [file, query] = id.split('?', 2)
      if (!file?.endsWith('.vue') || query !== 'raw&highlight') {
        return
      }

      this.addWatchFile(file)
      const source = await readFile(file, 'utf8')
      highlighter ??= createHighlighterCoreSync({
        engine: createJavaScriptRegexEngine(),
        langs: [vueGrammar],
        themes: [githubDarkDefault, githubLight],
      })
      const html = highlighter.codeToHtml(source.trimEnd(), {
        defaultColor: false,
        lang: 'vue',
        tabindex: false,
        themes: {
          dark: 'github-dark-default',
          light: 'github-light',
        },
      })
      return `export default ${JSON.stringify({ html, source })}`
    },
    name: 'playground:source-preview',
  }
}

export default defineConfig({
  plugins: [sourcePreview(), UnoCSS(), vue()],
  resolve: {
    alias: {
      'vue-tweakpane': fileURLToPath(
        new URL('../src/index.ts', import.meta.url),
      ),
    },
  },
})
